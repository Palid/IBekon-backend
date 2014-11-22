"use strict";

// Node core
var net = require('net');

// Community
var _ = require('lodash');
var shortID = require('short-id');

// Config and inside libs
var config = require('./config/game.js');
var joinCMD = require('./sockets/join.js');

shortID.configure({
  length: 4, // The length of the id strings to generate
  algorithm: 'sha1', // The hashing algoritm to use in generating keys
  salt: Math.random // A salt value or function
});

// CONST
var currentGames = {};


function newGame(userId) {
  var game = {
    // gameId: shortID.generate(),
    gameId: '1234',
    settings: {
      beaconDelay: 10,
      gameTime: 120,
      victoryPoints: 1000,
      pointsPerTick: 10,
      tickPeriod: 10,
      maxPlayers: 2
    },
    beacons: [],
    players: [],
    host: userId
  };
  return game;
}

function getSingleRequest(obj) {
  return JSON.stringify(obj) + '\n\r';
}

function commonResponse(status, obj) {
  var response = {
    status: status
  };
  return getSingleRequest(_.extend(response, obj));
}

function returnGameUsers(gameId) {
  var game = currentGames[gameId];
  return _.transform(game, function(result, item, key) {
    if (key === 'players') {
      result.players = _.map(game.players, function(item) {
        return item.socket.user.userId;
      });
    } else {
      result[key] = item;
    }
  });
}

/**
 * Socket parser
 * @param  {[type]} socket [description]
 * @return {[type]}        [description]
 */
var server = net.createServer(config, function(socket) {
  console.log("user connected");
  socket.setEncoding("utf8");
  socket.on('data', function(data) {
    console.log("received data:");
    console.log(data);
    var splitted = data.split('\n\r');
    _.pull(splitted, '');
    splitted.forEach(function(item) {
      var parsed,
        gameId,
        game;
      try {
        parsed = JSON.parse(item);
      } catch (err) {
        if (err) {
          console.log(err);
          return;
        }
      }
      switch (parsed.command) {
        case "CONNECT":
          if (parsed.request && parsed.request.userId) {
            socket.user = {
              userId: parsed.request.userId
            };
            socket.write(commonResponse("OK"));
          } else {
            socket.write(commonResponse("ERR"));
          }
          break;
        case "HOST":
          socket.game = newGame(socket.user.userId);
          gameId = socket.game.gameId;
          socket.game.players.push({
            socket: socket
          });
          currentGames[gameId] = socket.game;
          socket.write(getSingleRequest(returnGameUsers(gameId)));
          break;
        case "JOIN":
          gameId = parsed.request.gameId;
          game = currentGames[gameId];
          if (game) {
            if (game.settings.maxPlayers > game.players.length) {
              game.players.push({
                socket: socket
              });
              socket.game = game;
              currentGames[gameId] = game;
              game.players.forEach(function(item) {
                item.socket.write(getSingleRequest(returnGameUsers(gameId)));
              });
            } else {
              socket.write(getSingleRequest({
                status: "ERR",
                description: "Maximum players amount exceeded.",
                date: Date.now,
                command: parsed && parsed.command ? parsed.command : 'undefined'
              }));
            }
          } else {
            socket.write(getSingleRequest({
              status: "ERR",
              description: "Game not found.",
              date: Date.now,
              command: parsed && parsed.command ? parsed.command : 'undefined'
            }));
          }
          break;
        case "LOBBY_UPDATE":
          if (parsed && parsed.request && parsed.request.gameId) {
            gameId = parsed.request.gameId;
            game = currentGames[gameId];
            if (parsed.request.userId === currentGames[gameId].host) {
              // Retarded 'anticheat'.
              var clearObj = _.transform(currentGames[gameId], function(result, item, key) {
                if (key !== "players" || key !== "host") {
                  result[key] = item;
                }
              });
              _.extend(clearObj, parsed.request);
            }
            if (!_.isUndefined(parsed.request.ready)) {
              var playerIndex = _.findIndex(game.players, {
                userId: parsed.request.userId
              });
              game.players[0].ready = parsed.request.ready;
            }
            game.players.forEach(function(item) {
              item.socket.write(getSingleRequest(returnGameUsers(gameId)));
            });
          }
          break;
        case "GAME":
          break;
        case "CAPTURE":
          break;
        case "IN_CAPTURE":
          break;
      }
    });
  });
});

server.listen(8069);
console.log(server.prototype);

server.on('error', function(err) {
  if (err.code === "EADDRINUSE") {
    console.log("Wrong address");
    process.exit(1);
  }
});


var client = net.connect({
  port: 8069,
  host: 'localhost',
  allowHalfOpen: false
}, function() {
  console.log("user connected");
});

client.setEncoding('utf8');
client.write(getSingleRequest({
  command: "CONNECT",
  request: {
    userId: shortID.generate()
  }
}));


client.write(getSingleRequest({
  "command": "HOST",
  "request": {}
}));


client.on('data', function(data) {
  console.log(data);
});


var client2 = net.connect({
  port: 8069,
  host: 'localhost',
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
    "gameId": '1234'
  }
}));

client2.on('data', function(data) {
  console.log(data);
});


client2.write(getSingleRequest({
  command: "LOBBY_UPDATE",
  request: {
    gameId: '1234',
    ready: false
  }
}));
