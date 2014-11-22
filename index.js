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

function getSingleRequest(obj) {
  return JSON.stringify(obj) + '\n\r';
}

function errorBuilder(command, description) {
  return getSingleRequest({
    status: "ERR",
    description: description,
    command: command,
    date: Date.now()
  });
}

function startGame(Game) {
  var gameProgress = {
    beacons: _.map(Game.beacons, function(beacon) {
      return {
        // name: '',
        beaconId: beacon.beaconId,
        state: 'captured',
        owner: 'neutral',
        currentCapturingTime: 0,
        movementLockTime: 0,
        stats: {
          capturingTimeTotal: 0,
          captureTriesTotal: 0,
          longestInHold: {
            by: 'neutral',
            time: 0
          },
          firstCapturedBy: undefined
        }
      };
    }),
    players: _.map(Game.players, function(player) {
      return {
        userId: player.userId,
        score: 0,
        stats: {
          timeSpentOnCaptures: 0,
          totalCaptureTries: 0,
          succeededCaptures: 0,
          failedCaptures: 0
        },
        lastSyncDate: Date.now()
      };
    }),
    gameStartTime: Date.now(),
    gameLength: Game.settings.gameTime > 20 ? 6000 * 20 : Game.settings.gameTime
  };
  console.log(Game);

  var progress = {
    interval: setInterval(function() {
      // console.log("POTATO");
      // console.log(Game);
      Game.players.forEach(function(player) {
        player.socket.write(getSingleRequest({
        }));
      });
      clearInterval(progress.interval);
    }, 1000)

  };
  return gameProgress;
}

function newGame(userId) {
  var game = {
    // UNCOMMENT LATER
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


function returnGameUsers(gameId, command) {
  var game = currentGames[gameId];
  var gameUsers = {
    response: _.extend(_.transform(game, function(result, item, key) {
      if (key === 'players' || key === "progress") {
        result.players = _.map(game.players, function(item) {
          return {
            userId: item.socket.user.userId,
            ready: item.socket.user.ready
          };
        });
      } else {
        result[key] = item;
      }
    }), {
      date: Date.now()
    }),
    command: command,
    status: "OK"
  };
  return gameUsers;
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
      if (parsed && parsed.request) {
        switch (parsed.command) {
          case "CONNECT":
            if (parsed.request && parsed.request.userId) {
              socket.user = {
                userId: parsed.request.userId
              };
              socket.write(getSingleRequest({
                status: "OK",
                date: Date.now()
              }));
            } else {
              socket.write(errorBuilder("CONNECT", "No userID provided."));
            }
            break;
          case "HOST":
            socket.game = newGame(socket.user.userId);
            gameId = socket.game.gameId;
            socket.game.players.push({
              socket: socket,
              userId: socket.user.userId
            });
            currentGames[gameId] = socket.game;
            socket.write(getSingleRequest(returnGameUsers(gameId, parsed.command)));
            break;
          case "JOIN":
            // Get parsed gameID
            gameId = parsed.request.gameId;
            game = currentGames[gameId];
            if (game) {
              if (game.state === "lobby") {
                if (game.settings.maxPlayers > game.players.length) {
                  game.players.push({
                    socket: socket,
                    userId: socket.user.userId
                  });
                  socket.game = game;
                  currentGames[gameId] = game;
                  game.players.forEach(function(item) {
                    item.socket.write(getSingleRequest(returnGameUsers(gameId, parsed.command)));
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
            break;
          case "LOBBY_UPDATE":
            gameId = socket.game.gameId;
            game = currentGames[gameId];
            if (game.state === "lobby") {
              var playerIndex = _.findIndex(game.players, {
                userId: socket.user.userId
              });
              if (playerIndex !== -1) {
                if (socket.user.userId === currentGames[gameId].host) {
                  // Retarded 'anticheat'.
                  var clearObj = _.transform(currentGames[gameId], function(result, item, key) {
                    if (key !== "players" || key !== "host" || key !== "state") {
                      result[key] = item;
                    }
                  });
                  currentGames[gameId] = _.extend(clearObj, parsed.request);
                }
                if (!_.isUndefined(parsed.request.ready)) {
                  game.players[playerIndex].ready = parsed.request.ready;
                }
                game.players.forEach(function(item) {
                  item.socket.write(getSingleRequest(returnGameUsers(gameId, parsed.command)));
                });
              } else {
                socket.write(errorBuilder("LOBBY_UPDATE", "You're not in the game " + gameId));
              }
            } else {
              socket.write(errorBuilder("LOBBY_UPDATE", "Game already started or finished."));
            }
            break;
          case "GAME":
            gameId = socket.game.gameId;
            game = currentGames[gameId];
            if (socket.user.userId === currentGames[gameId].host) {
              if (_.every(game.players, 'ready')) {
                currentGames[gameId].state = 'started';
                // Setup game progress
                game.progress = startGame(game);
                game.players.forEach(function(item) {
                  item.socket.write(getSingleRequest(returnGameUsers(gameId, parsed.command)));
                });
              } else {
                socket.write(errorBuilder("GAME", _.countBy(game.players, function(player) {
                  return player.ready;
                }).false + " player(s) aren't ready yet."));
              }
            } else {
              socket.write(errorBuilder("GAME", "You're not the host!"));
            }
            break;
          case "SYNC":
            gameId = socket.game.gameId;
            game = currentGames[gameId];
            // if (parsed.request.beacon) {
              console.log(game);
            // }
            break;
          case "CAPTURE":
            break;
          case "CAPTURED":
            break;
          case "CAPTURE_FAIL":
            break;
          case "END":
            break;
        }
      } else {
        var cmd = parsed && parsed.command ? parsed.command : "UNDEFINED";
        socket.write(errorBuilder(cmd, "Wrong request!"));
      }
    });
  });
});

server.listen(config.port);

server.on('error', function(err) {
  if (err.code === "EADDRINUSE") {
    console.log("Wrong address");
    process.exit(1);
  }
});

// require('./_tests_.js');
