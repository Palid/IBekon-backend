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
// Logger


// Config and inside libs

var config = require('./config/game.js');
var requestBuilder = require('./util/request-builder.js');


// CONST
var Game = require('./game.js');

function sendAndLog(socket, request) {
  coreLogger.log('info', request);
  socket.write(request);
}


function returnGameUsers(gameObject, command) {
  var gameUsers = {
    response: _.extend(_.transform(gameObject, function (result, item, key) {
      if (key === 'players' || key === "progress") {
        result.players = _.map(gameObject.players, function (item) {
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
var server = net.createServer(config, function (socket) {
  console.log("Server noticed that user connected.");
  socket.setEncoding("utf8");
  socket.on('close', function () {
    Game.cleanup(socket);
  });
  socket.on('data', function (data) {
    coreLogger.log('info', data);
    var splitted = data.split('\n\r');
    _.pull(splitted, '');
    splitted.forEach(function (item) {
      var parsed,
        gameId;
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
            socket.write(requestBuilder.single({
              status: "OK",
              date: Date.now()
            }));
          } else {
            socket.write(requestBuilder.error("CONNECT", "No userID provided."));
          }
          break;
        case "HOST":
          if (socket.user && socket.user.userId) {
            socket.game = Game.create(socket.user.userId);
            socket.game.players.push({
              socket: socket,
              userId: socket.user.userId
            });
            sendAndLog(socket, requestBuilder.single(returnGameUsers(socket.game, socket.command)));
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
                  socket.game.players.forEach(function (item) {
                    item.socket.write(requestBuilder.single(returnGameUsers(gameId, item.socket.command)));
                  });
                } else {
                  socket.write(requestBuilder.error("JOIN", "Maximum players amount exceeded."));
                }
              } else if (socket.game.state === "started") {
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
              } else {
                socket.write(requestBuilder.error("JOIN", "Game already started or finished"));
              }
            } else {
              socket.write(requestBuilder.error("JOIN", "Game not found."));
            }
          }
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
                    var clearObj = _.transform(socket.game, function (result, item, key) {
                      if (key !== "players" || key !== "host" || key !== "state") {
                        result[key] = item;
                      }
                    });
                    socket.game = _.extend(clearObj, parsed.request);
                  }
                  if (!_.isUndefined(parsed.request.ready)) {
                    socket.game.players[playerIndex].ready = parsed.request.ready;
                  }
                  socket.game.players.forEach(function (item) {
                    item.socket.write(requestBuilder.single(returnGameUsers(gameId, item.socket.command)));
                  });
                } else {
                  socket.write(requestBuilder.error("LOBBY_UPDATE", "You're not in the game " + gameId));
                }
              } {
                socket.write(requestBuilder.error("LOBBY_UPDATE", "Game already started or finished."));
              }
              //Bo temporal nie umie
              // FIXME
            } else {
              socket.write(requestBuilder.error("LOBBY_UPDATE", "Game not found!"));
            }
          }
          break;
        case "GAME":
          if (socket.user && socket.user.userId) {
            if (socket.user.userId === socket.game.host) {
              // FIX LATER;
              // if (_.every(game.players, 'ready')) {
              // FIXME
              if (true) {
                Game.start(socket.game);
                Game.sync(socket.game);
                // game.players.forEach(function(item) {
                //   item.socket.write(requestBuilder.single(returnGameUsers(gameId, item.socket.command)));
                // });
                /**
                 * Setup game interval
                 * @return {[type]} [description]
                 */
                // game.sys.scoreInterval = setInterval(function() {
                //   game.progress.beacons.forEach(function(beacon) {
                //     if (beacon.owner !== 'neutral') {
                //       _.where(game.progress.players, {userId: beacon.owner}).forEach(function(user){
                //         user.score = game.settings.pointsPerTick + user.score;
                //       });
                //     }
                //   });
                // }, 333);
                // game.sys.syncInterval = setInterval(function() {
                //   Game.sync(game);
                //   if (((Date.now() - game.progress.gameStartTime) > game.progress.gameLength) || _.find(game.progress.players), function(player){
                //     return player.score >= game.settings.victoryPoints;
                //   }) {
                //     clearInterval(game.sys.syncInterval);
                //   }
                // }, 1000);
              } else {
                socket.write(requestBuilder.error("GAME", _.countBy(socket.game.players, function (player) {
                  return player.ready;
                }).false + " player(s) aren't ready yet."));
              }
            } else {
              socket.write(requestBuilder.error("GAME", "You're not the host!"));
            }
          }
          break;
        case "CAPTURE":
          if (socket.user && socket.user.userId) {
            if (socket.game) {
              if (parsed.request.beaconId) {
                var currentBeacon = _.find(socket.game.progress.beacons, function (item) {
                  return item.beaconId === parsed.request.beaconId;
                });
                if (currentBeacon && currentBeacon.owner !== socket.user.userId) {
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
                    currentBeacon.system.captureInterval = setInterval(function () {
                      currentBeacon.currentCapturingTime += 100;
                      currentBeacon.stats.capturingTimeTotal += 100;
                      if (currentBeacon.currentCapturingTime >= socket.game.settings.captureTime * 1000) {
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
                  Game.sync(socket.game);
                  currentBeacon.stats.allCaptures.push({
                    userId: socket.user.userId,
                    date: Date.now()
                  });
                  currentBeacon.system.lastCaptures.push(socket.user.userId);
                }
              }
            } else {
              socket.write(requestBuilder.error("CAPTURE", "Game not found!"));
            }
          }
          break;
        case "CAPTURED":
          if (socket.user && socket.user.userId) {
            Game.sync(socket.game);
          }
          break;
        case "END":
          if (socket.user && socket.user.userId) {
            Game.cleanup(socket.game);
          }
          break;
        }
      } else {
        var cmd = parsed && parsed.command ? parsed.command : "UNDEFINED";
        socket.write(requestBuilder.error(cmd, "Wrong request!"));
      }
    });
  });
});

server.listen(config.port);

server.on('error', function (err) {
  if (err.code === "EADDRINUSE") {
    console.log("Wrong address");
    // process.exit(1);
  }
  console.log(err);
});

require('./my-test.js');