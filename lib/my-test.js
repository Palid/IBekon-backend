"use strict";

var net = require('net');

var _ = require('lodash');

var config = require('./config/game.js');

// var config = {
//   host: 'IBekon.mybluemix.net',
//   port: 80,
// };
var shortID = require('short-id');


function getSingleRequest(obj) {
  return JSON.stringify(obj) + '\n\r';
}

// var DEBUG = true;
var DEBUG = false;

var BEACONS = [];
for (var i = 0; i < 4; i++) {
  BEACONS.push({
    beaconId: shortID.generate()
  });
}

var GAMEID = null;

var client1 = net.connect({
  port: config.port,
  host: config.host,
  allowHalfOpen: false
}, function() {
  console.log("user connected");
});


client1.on('data', function(data) {
  if (DEBUG) {
    console.log("client 1");
    console.log(data);
    console.log("End of client 1");
  }
  var splitted = data.split('\n\r');
  _.pull(splitted, '');
  if (splitted) {
    var parsed = JSON.parse(splitted[0]);
    if (parsed.response && parsed.response.gameId) {
      GAMEID = parsed.response.gameId;
    }
  }
});

client1.setEncoding('utf8');
client1.write(getSingleRequest({
  command: "CONNECT",
  request: {
    userId: shortID.generate()
    // userId: 'client1'
  }
}));

setTimeout(function() {

  client1.write(getSingleRequest({
    "command": "HOST",
    "request": {
    }
  }));

}, 100);



setTimeout(function() {
  var client2 = net.connect({
    port: config.port,
    host: config.host,
    allowHalfOpen: false
  }, function() {
    console.log("user connected");
  });

  client2.setEncoding('utf8');

  client2.write(getSingleRequest({
    command: "CONNECT",
    request: {
      userId: shortID.generate()
    }
  }));

  client2.write(getSingleRequest({
    "command": "JOIN",
    "request": {
      "gameId": GAMEID
    }
  }));

  client2.on('data', function(data) {
    if (DEBUG) {
      console.log("CLIENT 2");
      console.log(data);
      console.log("END OF CLIENT 2");
    }
  });


  setTimeout(function() {
    client2.write(getSingleRequest({
      command: "LOBBY_UPDATE",
      request: {
        ready: true
      }
    }));

  }, 20);

  setTimeout(function() {
    client1.write(getSingleRequest({
      command: "LOBBY_UPDATE",
      request: {
        ready: true,
        beacons: BEACONS
      }
    }));

  }, 30);

  setTimeout(function() {
    client1.write(getSingleRequest({
      command: "GAME",
      request: {}
    }));
  }, 50);

  setTimeout(function() {
    client1.write(getSingleRequest({
      command: "CAPTURE",
      request: {
        beaconId: BEACONS[0].beaconId
      }
    }));
  }, 60);

  setTimeout(function() {
    client2.write(getSingleRequest({
      command: "CAPTURE",
      request: {
        beaconId: BEACONS[0].beaconId
      }
    }));
  }, 65);

}, 5000);
