"use strict";

// Node core
var net = require('net');

// Community
var _ = require('lodash');
// logger
var winston = require('winston');
var shortID = require('short-id');

// Config and inside libs
//
var config = require('./config/game.js');
winston.add(winston.transports.File, {
  filename: 'somefile.log'
});
shortID.configure({
  length: 4, // The length of the id strings to generate
  algorithm: 'sha1', // The hashing algoritm to use in generating keys
  salt: Math.random // A salt value or function
});

// CONST
var currentGames = {};

function sendAndLog(socket, request) {
  winston.log('info', request);
  socket.write(request);
}

function cleanup(socket) {
  if (socket.game) {
    var game = currentGames[socket.game.gameId];
    Array.prototype.forEach.call(game.sys, function(interval) {
      clearInterval(interval);
    });
    if (game.progress) {
      game.progress.beacons.forEach(function(post) {
        if (post.interval) {
          clearInterval(post.interval);
        }
      });
    }
  }
}

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

function startGame(game) {
  var gameProgress = {
    beacons: _.map(game.beacons, function(beacon) {
      return {
        // name: '',
        beaconId: beacon.beaconId,
        state: 'captured',
        owner: 'neutral',
        currentCapturingTime: 0,
        movementLockTime: 0,
        /**
         * allCaptures is an array storing all capture tries as objects
         * @type {Array}
         * @param {Object} capture log object
         * @param {String} userId   ID of player capturing the beacon
         * @param {Date} date Date.now()
         */
        stats: {
          allCaptures: [],
          lastCaptureTry: null,
          capturingTimeTotal: 0,
          longestInHold: {
            by: 'neutral',
            time: 0
          },
          firstCapturedBy: null
        },
        system: {
          captureInterval: null,
          lastCaptures: []
        }
      };
    }),
    players: _.map(game.players, function(player) {
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
    gameLength: game.settings.gameTime > 20 ? 1000 * 60 * 20 : game.settings.gameTime * 1000 * 60
  };

  return gameProgress;
}

function syncGame(game) {
  var progress = _.transform(game.progress, function(result, item, key) {
    if (key === "beacons") {
      result[key] = _.map(item, function(beacon) {
        return _.transform(beacon, function(result, item, key) {
          if (key !== "system" && key !== "stats") {
            result[key] = item;
          }
        });
      });
    }
  });
  game.players.forEach(function(player) {
    var request = getSingleRequest({
      command: "SYNC",
      response: progress,
      status: "OK",
      date: Date.now()
    });
    winston.log('info', request);
    player.socket.write(request);
  });
}

function newGame(userId) {
  var game = {
    gameId: shortID.generate(),
    settings: {
      captureTime: 5,
      afterCaptureDelay: 10,
      gameTime: 120,
      victoryPoints: 10000,
      pointsPerTick: 10,
      tickPeriod: 10,
      maxPlayers: 2
    },
    beacons: [],
    players: [],
    host: userId,
    state: "lobby",
    sys: {}
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
            ready: true || item.socket.user.ready
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
  socket.on('close', function() {
    cleanup(socket);
  });
  socket.on('data', function(data) {
    winston.log('info', data);
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
        if (parsed.command) socket.command = parsed.command;
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
            if (socket.user && socket.user.userId) {
              socket.game = newGame(socket.user.userId);
              socket.game.players.push({
                socket: socket,
                userId: socket.user.userId
              });
              currentGames[socket.game.gameId] = socket.game;
              sendAndLog(socket, getSingleRequest(returnGameUsers(socket.game.gameId, socket.command)));
            }
            break;
          case "JOIN":
            if (socket.user && socket.user.userId) {
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
                      item.socket.write(getSingleRequest(returnGameUsers(gameId, item.socket.command)));
                    });

                  } else {
                    socket.write(errorBuilder("JOIN", "Maximum players amount exceeded."));
                  }
                  // DELETE ME LATER
                  if (game.players.length === 2) {
                    game = currentGames[socket.game.gameId];
                    if (socket.user.userId === currentGames[socket.game.gameId].host) {
                      // if (_.every(game.players, 'ready')) {
                      if (true) {
                        game.state = 'started';
                        // Setup game progress
                        game.progress = startGame(game);
                        syncGame(game);
                        /**
                         * Setup game interval
                         * @return {[type]} [description]
                         */
                        game.sys.scoreInterval = setInterval(function() {
                          game.progress.beacons.forEach(function(beacon) {
                            if (beacon.owner !== 'neutral') {
                              _.where(game.progress.players, {
                                userId: beacon.owner
                              }).forEach(function(user) {
                                user.score = game.settings.pointsPerTick + user.score;
                              });
                            }
                          });
                        }, 333);
                        game.sys.syncInterval = setInterval(function() {
                          syncGame(game);
                          if (((Date.now() - game.progress.gameStartTime) > game.progress.gameLength) || _.find(game.progress.players), function(player) {
                              return player.score >= game.settings.victoryPoints;
                            }) {
                            clearInterval(game.sys.syncInterval);
                          }
                        }, 1000);
                      } else {
                        socket.write(errorBuilder("GAME", _.countBy(game.players, function(player) {
                          return player.ready;
                        }).false + " player(s) aren't ready yet."));
                      }
                    } else {
                      socket.write(errorBuilder("GAME", "You're not the host!"));
                    }
                  }
                  // DELETE ME LATER
                } else {
                  socket.write(errorBuilder("JOIN", "Game already started or finished"));
                }
              } else {
                socket.write(errorBuilder("JOIN", "Game not found."));
              }
            }
            break;
            case "LOBBY_UPDATE":
              if (socket.user && socket.user.userId) {
                if (socket.game) {
                  game = currentGames[socket.game.gameId];
                  if (game.state === "lobby") {
                    var playerIndex = _.findIndex(game.players, {
                      userId: socket.user.userId
                    });
                    if (playerIndex !== -1) {
                      if (socket.user.userId === currentGames[socket.game.gameId].host) {
                        // Retarded 'anticheat'.
                        var clearObj = _.transform(currentGames[socket.game.gameId], function(result, item, key) {
                          if (key !== "players" || key !== "host" || key !== "state") {
                            result[key] = item;
                          }
                        });
                        currentGames[socket.game.gameId] = _.extend(clearObj, parsed.request);
                      }
                      if (!_.isUndefined(parsed.request.ready)) {
                        game.players[playerIndex].ready = parsed.request.ready;
                      }
                      game.players.forEach(function(item) {
                        item.socket.write(getSingleRequest(returnGameUsers(gameId, item.socket.command)));
                      });
                    } else {
                      socket.write(errorBuilder("LOBBY_UPDATE", "You're not in the game " + gameId));
                    }
                  } else {
                    socket.write(errorBuilder("LOBBY_UPDATE", "Game already started or finished."));
                  }
                } else {
                  socket.write(errorBuilder("LOBBY_UPDATE", "Game not found!"));
                }
              }
              break;
            case "GAME":
              if (socket.user && socket.user.userId) {
                game = currentGames[socket.game.gameId];
                if (socket.user.userId === currentGames[socket.game.gameId].host) {
                  if (_.every(game.players, 'ready')) {
                    game.state = 'started';
                    // Setup game progress
                    game.progress = startGame(game);
                    game.players.forEach(function(item) {
                      item.socket.write(getSingleRequest(returnGameUsers(gameId, item.socket.command)));
                    });
                    /**
                     * Setup game interval
                     * @return {[type]} [description]
                     */
                    game.sys.scoreInterval = setInterval(function() {
                      game.progress.beacons.forEach(function(beacon) {
                        if (beacon.owner !== 'neutral') {
                          _.where(game.progress.players, {userId: beacon.owner}).forEach(function(user){
                            user.score = game.settings.pointsPerTick + user.score;
                          });
                        }
                      });
                    }, 333);
                    game.sys.syncInterval = setInterval(function() {
                      syncGame(game);
                      if (((Date.now() - game.progress.gameStartTime) > game.progress.gameLength) || _.find(game.progress.players), function(player){
                        return player.score >= game.settings.victoryPoints;
                      }) {
                        clearInterval(game.sys.syncInterval);
                      }
                    }, 1000);
                  } else {
                    socket.write(errorBuilder("GAME", _.countBy(game.players, function(player) {
                      return player.ready;
                    }).false + " player(s) aren't ready yet."));
                  }
                } else {
                  socket.write(errorBuilder("GAME", "You're not the host!"));
                }
              }
              break;
            // case "SYNC":
            // if (socket.user && socket.user.userId) {

            //   game = currentGames[socket.game.gameId];
            //   }
            //   break;
          case "CAPTURE":
            if (socket.user && socket.user.userId) {
              if (socket.game) {
                game = currentGames[socket.game.gameId];
                if (parsed.request.beaconId) {
                  var currentBeacon = _.find(game.progress.beacons, parsed.request.beaconId);
                  if (currentBeacon.owner !== socket.user.userId) {
                    if (currentBeacon.system.captureInterval) {
                      clearInterval(currentBeacon.system.captureInterval);
                      currentBeacon.currentCapturingTime = 0;
                    }
                    currentBeacon.stats.lastCaptureTry = {
                      date: Date.now(),
                      userId: socket.user.userId
                    };
                    if (currentBeacon.state === "inCapture" && _.last(currentBeacon.system.lastCaptures) !== socket.user.userId) {
                      currentBeacon.state = "capture";
                      currentBeacon.owner = "neutral";
                    } else {
                      currentBeacon.state = "inCapture";
                      currentBeacon.currentCapturingTime = 0;
                      syncGame(game);
                      currentBeacon.system.captureInterval = setInterval(function() {
                        currentBeacon.currentCapturingTime += 100;
                        currentBeacon.stats.capturingTimeTotal += 100;
                        if (currentBeacon.currentCapturingTime >= game.settings.captureTime * 1000) {
                          clearInterval(currentBeacon.system.captureInterval);
                          currentBeacon.currentCapturingTime = 0;
                          currentBeacon.owner = socket.user.userId;
                          currentBeacon.state = "capture";
                          currentBeacon.system.lastCaptures = [];
                          if (!currentBeacon.firstCapturedBy) currentBeacon.firstCapturedBy = {
                            date: Date.now(),
                            userId: socket.user.userId
                          };
                        }
                      }, 100);
                    }
                    currentBeacon.stats.allCaptures.push({
                      userId: socket.user.userId,
                      date: Date.now()
                    });
                    currentBeacon.system.lastCaptures.push(socket.user.userId);
                  }
                }
              } else {
                socket.write(errorBuilder("CAPTURE", "Game not found!"));
              }
            }
            break;
          case "CAPTURED":
            if (socket.user && socket.user.userId) {
              syncGame(currentGames[socket.game.gameId]);
            }
            break;
          case "END":
            if (socket.user && socket.user.userId) {
              cleanup(socket);
            }
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
    // process.exit(1);
  }
  console.log(err);
});

// require('./_tests_.js');
