"use strict";

// Node core
var net = require('net');

// Community
var _ = require('lodash');
var shortID = require('short-id');

// Config and inside libs
var config = require('./config/game.js');

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
    host: userId,
    state: "lobby"
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

function errorBuilder(command, description) {
  return getSingleRequest({
    status: "ERR",
    description: description,
    command: command,
    date: Date.now()
  });
}

function returnGameUsers(gameId) {
  var game = currentGames[gameId];
  game.status = "OK";
  game.date = Date.now();
  return _.transform(game, function(result, item, key) {
    if (key === 'players') {
      result.players = _.map(game.players, function(item) {
        return {
          userId: item.socket.user.userId,
          ready: item.socket.user.ready
        };
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
  console.log("Server noticed that user connected.");
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
        if (parsed && parsed.request && parsed.request.gameId) {
          gameId = parsed.request.gameId;
          game = currentGames[gameId];
          if (game) {
            if (game.state === "lobby") {
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
                socket.write(errorBuilder("JOIN", "Maximum players amount exceeded."));
              }
            } else {
              socket.write(errorBuilder("JOIN", "Game already started or finished"));
            }
          } else {
            socket.write(errorBuilder("JOIN", "Game not found."));
          }
        } else {
          socket.write(errorBuilder("JOIN", "Wrong request!"));
        }
          break;
        case "LOBBY_UPDATE":
          if (parsed && parsed.request && parsed.request.gameId) {
              gameId = parsed.request.gameId;
              game = currentGames[gameId];
              if (game.state === "lobby") {
                var playerIndex = _.findIndex(game.players, {
                  userId: parsed.request.userId
                });
                if (playerIndex !== -1) {
                  if (parsed.request.userId === currentGames[gameId].host) {
                    // Retarded 'anticheat'.
                    var clearObj = _.transform(currentGames[gameId], function(result, item, key) {
                      if (key !== "players" || key !== "host" || key !== "state") {
                        result[key] = item;
                      }
                    });
                    _.extend(clearObj, parsed.request);
                  }
                  if (!_.isUndefined(parsed.request.ready)) {
                    game.players[playerIndex].socket.user.ready = parsed.request.ready;
                  }
                  game.players.forEach(function(item) {
                    item.socket.write(getSingleRequest(returnGameUsers(gameId)));
                  });
                } else {
                  socket.write(errorBuilder("LOBBY_UPDATE", "You're not in the game " + gameId));
                }
              } else {
                socket.write(errorBuilder("LOBBY_UPDATE", "Game already started or finished."));
              }
          } else {
            socket.write(errorBuilder("LOBBY_UPDATE", "Wrong request!"));
          }
          break;
        case "GAME":
          if (parsed && parsed.request && parsed.request.gameId) {
            gameId = parsed.request.gameId;
            game = currentGames[gameId];
            if (parsed.request.userId === currentGames[gameId].host) {
              if (_.every(game.players, 'ready')) {
              currentGames[gameId].state = 'started';
                game.players.forEach(function(item) {
                  item.socket.write(getSingleRequest(returnGameUsers(gameId)));
                });
              } else {
                socket.write(errorBuilder("GAME",  _.countBy(game.players, function(player){
                  return player.ready;
                })  + " player(s) aren't ready yet."));
              }
            } else {
              socket.write(errorBuilder("GAME", "You're not the host!"));
            }
          } else {
            socket.write(errorBuilder("GAME", "Wrong request!"));
          }
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

server.on('error', function(err) {
  if (err.code === "EADDRINUSE") {
    console.log("Wrong address");
    process.exit(1);
  }
});


var client = net.connect({
  port: config.port,
  host: config.host,
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
  "request": {
    userId: shortID.generate()
  }
}));


client.on('data', function(data) {
  console.log("Client 1");
  console.log(data);
  console.log("End of client 1");
});


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
    "gameId": '1234'
  }
}));

client2.on('data', function(data) {
  console.log("CLIENT 2");
  console.log(data);
  console.log("END OF CLIENT 2");
});


client2.write(getSingleRequest({
  command: "LOBBY_UPDATE",
  request: {
    gameId: '1234',
    ready: false
  }
}));

setTimeout(function(){
  client2.write(getSingleRequest({
    command: "LOBBY_UPDATE",
    request: {
      gameId: '1234',
      ready: false
    }
  }));

}, 20);

setTimeout(function(){
  client2.write(getSingleRequest({
    command: "LOBBY_UPDATE",
    request: {
      gameId: '1234',
      ready: false
    }
  }));

}, 30);
