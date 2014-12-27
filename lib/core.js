"use strict";
/**
 * @fileOverview Game's core parser
 * @module  core
 * @author Dariusz 'Palid' Niemczyk
 * @requires lodash
 * @requires winston
 * @requires game
 * @requires requestUtil
 */

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

/**
 * The complete gameData object sent to player
 * @typedef {object} gameDataObject
 * @property {string} command Command sent by client
 * @property {string} status Response status
 * @property {date} date Datetime of this object's creation time (to sync players gametime)
 *
 * @property {object} response Whole response for client
 * @property {string} response.gameId Game's ID
 * @property {string} response.host Game's host ID
 * @property {object} response.settings Settings object
 * @property {number} response.captureTime Time a client has to be in beacon's close range to capture ite
 * @property {number} response.afterCaptureDelay Time a client had to wait after beacon's last move to collect points for it
 * @property {number} response.gameTime Game's time in minutes
 * @property {number} response.victoryPoints Victory points required to win the game
 * @property {number} response.pointsPerTick Points gained on each server tick for each captured beacon
 * @property {number} response.tickPeriod Time after which a new tick will start counting down
 * @property {number} response.maxPlayers Up to this number of players can be in this game
 *
 * @property {array.<object>} response.beacons Beacons array taking part in this game
 * @property {string} response.beacons.beaconId Beacon's unique ID
 *
 * @property {array.<object>} response.players Players array
 * @property {string} response.players.userId Client's unique device ID
 * @property {boolean} ready Player's ready status (each player has to be ready before game gets started)
 */


/**
 * Overwriting socket prototype write to explicitely log all communications
 */
var oldProto = net.Socket.prototype.write;
net.Socket.prototype.write = function(data, encoding, callback) {
  coreLogger.log('info', data);
  oldProto.call(this, data, encoding, callback);
};

/**
 * Returns an object with all game data for client
 * @param  {object} gameObject Current socket's game object (socket.game)
 * @return {gameDataObject}    Formatted object without any server-specific data
 */
function returnGameData(gameObject) {
  var gameUsers = {
    response: _.transform(gameObject, function(result, item, key) {
      switch (key) {
        case "players":
          result.players = _.map(gameObject.players, function(item) {
            return {
              userId: item.socket.user.userId,
              ready: item.socket.user.ready || false
            };
          });
          break;
        case "progress":
          ///////////
          // FIXME //
          ///////////
          // result.players = _.map(gameObject.players, function(item) {
          //   return {
          //     userId: item.socket.user.userId,
          //     ready: item.socket.user.ready || false
          //   };
          // });
          break;
        case "sys":
          break;
        default:
          result[key] = item;
          break;
      }
    }),
    date: Date.now()
  };
  return gameUsers;
}

function sendWrongRequestError(socket) {
  var error = requestUtil.error(socket.command, "Wrong command.");
  socket.write(error);
}

function updateAllPlayers(socket) {
  var i, response, dataForPlayer = returnGameData(socket.game);
  dataForPlayer.command = socket.command;
  dataForPlayer.status = "OK";
  response = requestUtil.build(dataForPlayer);
  for (i = 0; i < socket.game.players.length; i++) {
    socket.game.players[i].socket.write(response);
  }
}

/**
 * Extends gameObject by settings
 * @param {object} socket  Socket object
 * @param {object} request Config object (request)
 */
function setSettings(socket, request) {
  if (request.settings) {
    _.extend(socket.game.settings, _.transform(request.settings, function(result, item, key) {
      if (config.gameDefaults[key]) result[key] = item;
    }));
    console.log(socket.game.settings);
  } else {
    socket.game.settings = config.gameDefaults;
  }
}

/**
 * Updates game's settings and writes updated data to each player/client
 * @param  {object} socket Socket object
 * @param  {object} parsed Object with parsed data (client's 'request' object)
 */
function updateGameSettings(socket, parsed) {
  var playerIndex = _.findIndex(socket.game.players, {
    userId: socket.user.userId
  });
  if (playerIndex !== -1) {
    if (socket.user.userId === socket.game.host) {
      setSettings(socket, parsed.request);
    }
    if (_.isBoolean(parsed.request.ready)) {
      socket.game.players[playerIndex].ready = parsed.request.ready;
    }
    updateAllPlayers(socket);
  } else {
    socket.write(requestUtil.error(socket.command, "You're not in the game " + socket.game.gameId));
  }
}

/**
 * Huge parser defining behavior based on sent commands and server-stored data
 * @param  {object} socket Socket object
 * @param  {string} data   Any stringified data returned by socket.
 */
function gameParser(socket, data) {
  _.forEach(requestUtil.splitter(data), function(item) {
    var parsed = requestUtil.parser(item, coreLogger);

    if (parsed && parsed.request) {
      if (parsed.command) socket.command = parsed.command;

      if (!socket.user) {
        if (socket.command === "CONNECT") {
          if (parsed.request && parsed.request.userId) {
            socket.user = {
              userId: parsed.request.userId
            };
            socket.game = {};
            socket.write(requestUtil.build({
              status: "OK",
              date: Date.now()
            }));
          } else {
            socket.write(requestUtil.error(socket.command, "No userID provided."));
          }
        } else {
          socket.write(requestUtil.error(socket.command, "You have to authorize by CONNECT first."));
        }
      } else {
        switch (socket.command) {
          case "CONNECT":
            socket.write(requestUtil.error(socket.command, "userID has already been set by this client."));
            break;
          case "HOST":
            if (!socket.game.host) {
              socket.game = Game.factory(socket.user.userId);
              socket.game.players.push({
                socket: socket,
                userId: socket.user.userId
              });
              updateGameSettings(socket, parsed);
            } else {
              socket.write(requestUtil.error(socket.command, "Game with this userId is already initialied."));
            }
            break;
          case "JOIN":
            // Get parsed gameID
            socket.game.gameId = parsed.request ? parsed.request.gameId : null;
            socket.game = Game.get(socket.game.gameId);
            if (socket.game) {
              if (socket.game.host === socket.user.userId) {
                socket.write(requestUtil.error("JOIN", "You can't join a game while hosting one."));
                break;
              }
              if (socket.game.state === "lobby") {
                if (socket.game.settings.maxPlayers > socket.game.players.length) {
                  socket.game.players.push({
                    socket: socket,
                    userId: socket.user.userId
                  });
                  updateAllPlayers(socket);
                } else {
                  socket.write(requestUtil.error(socket.command, "Maximum players amount exceeded."));
                }
              } else {
                socket.write(requestUtil.error(socket.command, "Game already started or finished"));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "Game not found."));
            }
            break;
          case "LOBBY_UPDATE":
            if (socket.game) {
              if (socket.game.state === "lobby") {
                updateGameSettings(socket, parsed);
              } {
                socket.write(requestUtil.error(socket.command, "Game already started or finished."));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "Game not found."));
            }
            break;
          case "GAME":
            if (socket.user.userId === socket.game.host) {
              if (_.every(socket.game.players, 'ready')) {
                Game.start(socket.game);
                updateAllPlayers(socket);
              } else {
                socket.write(requestUtil.error(socket.command, _.countBy(socket.game.players, function(player) {
                  return player.ready;
                })['false'] + " player(s) aren't ready yet."));
              }
            } else {
              socket.write(requestUtil.error(socket.command, "You're not the host."));
            }
            break;
          case "CAPTURE":
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
              socket.write(requestUtil.error(socket.command, "Game not found."));
            }
            break;
          case "CAPTURED":
            // Force sync
            Game.sync(socket.game);
            break;
          case "END":
            Game.cleanup(socket.game);
            break;
          case "PING":
            // TODO
            // Save last user response time in socket
            socket.write(requestUtil.build({
              command: "PONG",
              date: Date.now(),
              status: "OK"
            }));
            break;
          case "PONG":
            // TODO
            // Save last user response time in socket
            socket.write(requestUtil.build({
              command: "PING",
              date: Date.now(),
              status: "OK"
            }));
            break;
          default:
            socket.write(requestUtil.error(parsed.command, "You have provided wrong command."));
            break;
        }
      }

    } else {
      var cmd = parsed && parsed.command ? parsed.command : undefined;
      socket.write(requestUtil.error(cmd, 'Invalid request or data is not a valid JSON.'));
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
    gameParser(socket, data);
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
