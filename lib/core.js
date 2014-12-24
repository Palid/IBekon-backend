"use strict";

// Node core
var net = require('net');

var winston = require('winston');
var coreLogger = new winston.Logger({
  transports: [
    new(winston.transports.Console)(),
    new(winston.transports.File)({
      filename: 'somefile.log'
    })
  ]
});
// Community
var _ = require('lodash');
// Config and inside libs

var config = require('./config/game.js');
var requestUtil = require('./util/request.js');


// CONST
var Game = require('./game.js');

function sendAndLog(socket, request) {
  coreLogger.log('info', request);
  socket.write(request);
}


function returnGameUsers(gameObject, command) {
  var gameUsers = {
    response: _.transform(gameObject, function(result, item, key) {
      if (key === 'players' || key === "progress") {
        result.players = _.map(gameObject.players, function(item) {
          return {
            userId: item.socket.user.userId,
            ready: item.socket.user.ready || false
          };
        });
      } else {
        result[key] = item;
      }
    }, {
      date: Date.now()
    }),
    command: command,
    status: "OK"
  };
  return gameUsers;
}

function sendWrongRequestError(socket) {
  var error = requestUtil.error(socket.command, "Wrong command!");
  socket.write(error);
}

function gameLogic(socket, data) {
  coreLogger.log('info', data);
  var splitted = requestUtil.splitter(data);

  splitted.forEach(function(item) {
    var parsed, gameId, gameUsersRequest;

    try {
      parsed = JSON.parse(item);
    } catch (err) {
      coreLogger.log('info', err);
      socket.write(requestUtil.error(undefined, "Couldn't parse JSON."));
      return;
    }

    if (parsed && parsed.request) {
      if (parsed.command) socket.command = parsed.command;
      switch (parsed.command) {
        case "CONNECT":
        if (!socket.user) {
          if (parsed.request && parsed.request.userId) {
            socket.user = {
              userId: parsed.request.userId
            };
            socket.write(requestUtil.build({
              status: "OK",
              date: Date.now()
            }));
          } else {
            socket.write(requestUtil.error(socket.command, "No userID provided."));
          }
        } else {
          socket.write(requestUtil.error(socket.command, "userID has already been set by this client."));
        }
          break;
        case "HOST":
          if (socket.user && socket.user.userId) {
            if (!socket.game) {
              socket.game = Game.create(socket.user.userId);
              socket.game.players.push({
                socket: socket,
                userId: socket.user.userId
              });
              sendAndLog(socket, requestUtil.build(returnGameUsers(socket.game, socket.command)));
            } else {
              socket.write(requestUtil.error(socket.command, "Game with this userId is already initialied."));
            }
          } else {
              socket.write(requestUtil.error(socket.command, "You have to authorize by CONNECT first."));
          }
          break;
        case "JOIN":
          if (socket.user && socket.user.userId) {
            // Get parsed gameID
            gameId = parsed.request.gameId;
            socket.game = Game.get(gameId);
            if (socket.game) {
              socket.game.players.push({
                socket: socket,
                userId: socket.user.userId
              });
              if (socket.game.state === "lobby") {
                if (socket.game.settings.maxPlayers > socket.game.players.length) {
                  gameUsersRequest = requestUtil.build(returnGameUsers(gameId, socket.command));
                  socket.game.players.forEach(function(item) {
                    item.socket.write(gameUsersRequest);
                  });
                } else {
                  socket.write(requestUtil.error(socket.command, "Maximum players amount exceeded."));
                }
              }
              /**
              else if (socket.game.state === "started") {
                Game.sync(socket.game);
                socket.game.sys.scoreInterval = setInterval(function () {
                  socket.game.progress.beacons.forEach(function (beacon) {
                    if (beacon.owner !== 'neutral') {
                      _.where(socket.game.progress.players, {
                        userId: beacon.owner
                      }).forEach(function (user) {
                        user.score = socket.game.settings.pointsPerTick + user.score;
                      });
                    }
                  });
                }, 333);
                socket.game.sys.syncInterval = setInterval(function () {
                  Game.sync(socket.game);
                  if (((Date.now() - socket.game.progress.gameStartTime) > socket.game.progress.gameLength) || _.find(socket.game.progress.players), function (player) {
                      return player.score >= socket.game.settings.victoryPoints;
                    }) {
                    clearInterval(socket.game.sys.syncInterval);
                    // endGame(game);
                  }
                }, 1000);
              }
              **/
              else {
                socket.write(requestUtil.error(socket.command, "Game already started or finished"));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "Game not found."));
            }
          } else socket.write(requestUtil.error(socket.command, "You have to authorize by CONNECT first."));
          break;
        case "LOBBY_UPDATE":
          if (socket.user && socket.user.userId) {
            if (socket.game) {
              if (socket.game.state === "lobby") {
                var playerIndex = _.findIndex(socket.game.players, {
                  userId: socket.user.userId
                });
                if (playerIndex !== -1) {
                  if (socket.user.userId === socket.game.host) {
                    // Retarded 'anticheat'.
                    var clearObj = _.transform(socket.game, function(result, item, key) {
                      if (key !== "players" || key !== "host" || key !== "state") {
                        result[key] = item;
                      }
                    });
                    socket.game = _.extend(clearObj, parsed.request);
                  }
                  if (!_.isUndefined(parsed.request.ready)) {
                    socket.game.players[playerIndex].ready = parsed.request.ready;
                  }
                  gameUsersRequest = requestUtil.build(returnGameUsers(gameId, socket.command));
                  socket.game.players.forEach(function(item) {
                    item.socket.write(gameUsersRequest);
                  });
                } else {
                  socket.write(requestUtil.error(socket.command, "You're not in the game " + gameId));
                }
              } {
                socket.write(requestUtil.error(socket.command, "Game already started or finished."));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "Game not found!"));
            }
          } else sendWrongRequestError(socket);
          break;
        case "GAME":
          if (socket.user && socket.user.userId) {
            if (socket.user.userId === socket.game.host) {
              if (_.every(socket.game.players, 'ready')) {
                Game.start(socket.game);
                gameUsersRequest = requestUtil.build(returnGameUsers(gameId, socket.command));
                socket.game.players.forEach(function(item) {
                  item.socket.write(gameUsersRequest);
                });
              } else {
                socket.write(requestUtil.error(socket.command, _.countBy(socket.game.players, function(player) {
                  return player.ready;
                })['false'] + " player(s) aren't ready yet."));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "You're not the host!"));
            }
          } else sendWrongRequestError(socket);

          break;
        case "CAPTURE":
          if (socket.user && socket.user.userId) {
            if (socket.game && socket.game.state === "started") {
              if (parsed.request.beaconId) {
                var currentBeacon = _.find(socket.game.progress.beacons, function(item) {
                  return item.beaconId === parsed.request.beaconId;
                });
                if (currentBeacon && currentBeacon.owner !== socket.user.userId) {
                  if (currentBeacon.sys.captureInterval) {
                    clearInterval(currentBeacon.sys.captureInterval);
                    currentBeacon.currentCapturingTime = 0;
                  }
                  currentBeacon.stats.lastCaptureTry = {
                    date: Date.now(),
                    userId: socket.user.userId
                  };
                  if (currentBeacon.state === "inCapture" && _.last(currentBeacon.sys.lastCaptures) !== socket.user.userId) {
                    currentBeacon.state = "capture";
                    currentBeacon.owner = "neutral";
                  } else {
                    currentBeacon.state = "inCapture";
                    currentBeacon.currentCapturingTime = 0;
                    currentBeacon.sys.captureInterval = setInterval(function() {
                      currentBeacon.currentCapturingTime += 100;
                      currentBeacon.stats.capturingTimeTotal += 100;
                      if (currentBeacon.currentCapturingTime >= socket.game.settings.captureTime * 1000) {
                        clearInterval(currentBeacon.sys.captureInterval);
                        currentBeacon.currentCapturingTime = 0;
                        currentBeacon.owner = socket.user.userId;
                        currentBeacon.state = "capture";
                        currentBeacon.sys.lastCaptures = [];
                        Game.sync(socket.game);
                        if (!currentBeacon.firstCapturedBy) currentBeacon.firstCapturedBy = {
                          date: Date.now(),
                          userId: socket.user.userId
                        };
                      }
                    }, 100);
                  }
                  Game.sync(socket.game);
                  currentBeacon.stats.allCaptures.push({
                    userId: socket.user.userId,
                    date: Date.now()
                  });
                  currentBeacon.sys.lastCaptures.push(socket.user.userId);
                }
              }
            } else {
              socket.write(requestUtil.error(socket.command, "Game not found!"));
            }
          } else sendWrongRequestError(socket);
          break;
        case "CAPTURED":
          // Force sync
          if (socket.user && socket.user.userId) {
            Game.sync(socket.game);
          }
          break;
        case "END":
          if (socket.user && socket.user.userId) {
            Game.cleanup(socket.game);
          }
          break;
          // TODO
          // Save last user response time in socket
        case "PING":
          if (socket.user && socket.user.userId) {
            socket.write(requestUtil.build({
              command: "PONG",
              date: Date.now(),
              status: "OK"
            }));
          } else sendWrongRequestError(socket);
          break;
        case "PONG":
          if (socket.user && socket.user.userId) {
            socket.write(requestUtil.build({
              command: "PING",
              date: Date.now(),
              status: "OK"
            }));
          } else sendWrongRequestError(socket);
          break;
        default:
          socket.write(requestUtil.error(parsed.command, "You have provided wrong command."));
          break;
      }
    } else {
      var cmd = parsed && parsed.command ? parsed.command : undefined;
      socket.write(requestUtil.error(cmd, 'Wrong request!'));
    }
  });
}

var server = net.createServer(config, function(socket) {
  coreLogger.log('info', "Server noticed that user connected.");
  socket.setEncoding("utf8");

  socket.on('close', function() {
    Game.cleanup(socket);
  });

  socket.on('data', function(data) {
    gameLogic(socket, data);
  });
});

server.listen(config.port);

server.on('error', function(err) {
  if (err) {
    if (err.code === "EADDRINUSE") {
      console.log("Port already used.");
      process.exit(1);
    }
    console.log(err);
  }
});

// require('./my-test.js');

module.exports = gameLogic;
