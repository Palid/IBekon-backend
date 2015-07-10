"use strict";
/**
 * @fileOverview Main module for game
 * @module  game
 * @author Dariusz 'Palid' Niemczyk
 * @requires lodash
 * @requires short-id
 */

var _ = require('lodash');
var shortID = require('short-id');

shortID.configure({
  length: 4, // The length of the id strings to generate
  algorithm: 'sha1', // The hashing algoritm to use in generating keys
  salt: Math.random // A salt value or function
});

var requestUtil = require('./util/request.js');
var config = require('./config/game.js');

var currentGames = {};

/**
 * The complete gameObject shared between players stored in currentGames object.
 * @typedef {object} gameObject
 * @property {string} gameId Current game's ID.
 * @property {string} host Holds host's userId.
 * @property {string} state Current game's state.
 *
 * @property {object} settings Current game's settings.
 * @property {number} settings.captureTime At least this amount of seconds have to pass to capture a beacon by standing near it.
 * @property {number} settings.afterCaptureDelay To gain points at least this amount of seconds have to pass counting from beacon's last movement.
 * @property {number} settings.gameTime Game's maximum length in minutes.
 * @property {number} settings.victoryPoints Points required to get by player to win.
 * @property {number} settings.pointsPerTick Points received per tick for each controlled beacon.
 * @property {number} settings.tickPeriod Time in seconds after which points will be granted to player.
 * @property {number} settings.maxPlayers Maximum players amount that can join this game.
 *
 * @property {array} beacons Beacons array.
 *
 * @property {array} players Players array.
 *
 * @property {object} sys Holds every sys-only data like intervals. Updated after GAME command from host.
 * @property {interval} sys.scoreInterval Interval in which player scoring will update.
 * @property {interval} sys.syncInterval Interval in which command SYNC will be send to players with all data updates.
 *
 * @property {gameObjectProgress} progress Game's progress object in which all game-in-progress data is stored after GAME command from host.
 */

/**
 * gameObject's progress object in which whole actual game goes on.
 * @typedef {object} gameObjectProgress
 *
 * @property {date} gameStartTime Time of game's beginning
 * @property {Number} gameLength Game length calculated on gameObject.settings.gameTime
 *
 * @property {array.<object>} beacons Array of all beacons taking part in this game.
 * @property {string} beacons.beaconId Current beacon's ID
 * @property {string} beacons.state Current beacon's state (captured/in-capture)
 * @property {string} beacons.owner Current beacon's owner (playerID/neutral)
 * @property {number} beacons.currentCapturingTime Time passed on standing near the beacon to capture it
 * @property {number} beacons.movementLockTime Time that has to pass before beacon starts giving points after it last moved.
 * @property {object} beacons.stats Stats object, used only for after-game statistics screen
 * @property {array.<object>} beacons.stats.allCaptures Array with each captured made on the beacon
 * @property {object} beacons.stats.allCaptures.capture Object with user's ID and capture date
 * @property {string} beacons.stats.allCaptures.capture.userId Capturing player's ID
 * @property {date} beacons.stats.allCaptures.capture.date Capture's time
 * @property {number} beacons.lastCaptureTry Time of last capture try
 * @property {number} beacons.capturingTimeTotal Total time spent on capture tries by players
 * @property {object} beacons.longestInHold Object with informations about player having the beacon for the longest amount of time
 * @property {string} beacons.longestInHold.by Player's ID who had the beacon captured for the longest time
 * @property {string} beacons.firstCapturedBy Player's ID who captured the beacon first
 * @property {object} beacons.sys System object, not send to player
 * @property {interval} beacons.sys.captureInterval Beacon's private capture interval that starts on CAPTURE command sent from player
 * @property {array.<string>} beacons.sys.lastCaptures Beacon's last captures array used for determining if beacon should be neutral now
 * @property {string} beacons.sys.lastCaptures.array Players userIDs that last tried to capture the beacon
 *
 * @property {array.<object>} players Array of all players taking part in this game.
 * @property {date} players.lastSyncDate Time of last synchronization between client and server (SYNC command)
 * @property {string} players.userId Current player's userID
 * @property {number} players.score Current player's accmulated score
 * @property {object} players.stats Stats object, used only for after-game statistics screen
 * @property {number} players.stats.timeSpentOnCaptures Total time spent on capture tries
 * @property {number} players.stats.totalCaptureTries Total amount of capture tries
 * @property {number} players.stats.succeededCaptures Total amount of succeeded(not blocked) captures
 * @property {number} players.stats.failedCaptures Total amount of blocked captures
 *
 */

/**
 * Creates new game object and adds it into currentGames
 * @property  {string} userId  Current player's ID
 * @returns {gameObject} New gameObject
 */
function gameFactory(userId) {
  var gameId = shortID.generate(),
    game = {
      gameId: gameId,
      host: userId,
      state: "lobby",
      settings: config.gameDefaults,
      beacons: [],
      players: [],
      sys: {}
    };
  currentGames[gameId] = game;
  return game;
}

/**
 * Returns reference to game object or error if not found
 * @param  {string} gameId Player's current gameId
 * @return {gameObject|null} gameObject reference or null
 */
function getGame(gameId) {
  var checkedGame = currentGames[gameId];
  if (checkedGame) {
    return checkedGame;
  } else {
    return null;
  }
}

/**
 * Removes all intervals created in setupGameLoops from the {gameObject}
 * @param  {gameObject} gameObject
 * @returns {gameObject} Returns referenced gameObject
 */
function cleanAfterGame(gameObject) {
  if (gameObject) {
    _.forEach(gameObject.sys, function(gameInterval, key, collection) {
      clearInterval(gameInterval);
      delete collection[key];
    });
    if (gameObject.progress) {
      _.forEach(gameObject.beacons, function(beacon, key, collection) {
        if (beacon.interval) {
          clearInterval(beacon.interval);
          delete collection[key];
        }
      });
    }
  }
  return gameObject;
}

/**
 * Synchronize clients and server by sending server's game state to each client
 * @param  {gameObject} gameObject Current game object
 * @returns {gameObject} Returns referenced gameObject
 */
function syncGame(gameObject) {
  var progress = _.transform(gameObject.progress, function(result, item, key) {
    if (key === "beacons") {
      result[key] = _.map(item, function(beacon) {
        return _.transform(beacon, function(result, item, key) {
          if (key !== "sys" && key !== "stats") {
            result[key] = item;
          }
        });
      });
    } else {
      result[key] = item;
    }
  });
  _.forEach(gameObject.players, function(player) {
    var request = requestUtil.build({
      command: "SYNC",
      response: progress,
      status: "OK",
      date: Date.now()
    });
    player.socket.write(request);
  });
  return gameObject;
}


function updateGameObjectProgress(gameObject) {
  _.forEach(gameObject.progress.beacons, function(beacon) {
    if (beacon.owner !== 'neutral') {
      _.forEach(_.where(gameObject.progress.players, {
        userId: beacon.owner
      }), function(user) {
        user.score = gameObject.settings.pointsPerTick + user.score;
      });
    }
  });
}

function synchronizeGameObject(gameObject) {
  syncGame(gameObject);
  var victoriousPlayer = _.find(gameObject.progress.players, function(player) {
    return player.score >= gameObject.settings.victoryPoints;
  });
  if (((Date.now() - gameObject.progress.gameStartTime) > gameObject.progress.gameLength) || victoriousPlayer) {
    cleanAfterGame(gameObject);
  }
}

/**
 * Setups all game loops as intervals
 * @param  {gameObject} gameObject Current game object
 * @returns {gameObject} Returns referenced gameObject
 */
function setupGameLoops(gameObject) {
  gameObject.sys.scoreInterval = setInterval(updateGameObjectProgress , 1000 / 3);
  gameObject.sys.syncInterval = setInterval(synchronizeGameObject, 1000);
  return gameObject;
}

/**
 * Creates progress object in current gameObject and start game loops
 * @param  {gameObject} gameObject Current game's gameObject
 * @returns {gameObject} Returns referenced gameObject
 */
function startGame(gameObject) {
  var gameProgress = {
    beacons: _.map(gameObject.beacons, function(beacon) {
      return {
        // name: '',
        beaconId: beacon.beaconId,
        state: 'captured',
        owner: 'neutral',
        currentCapturingTime: 0,
        movementLockTime: 0,
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
        sys: {
          captureInterval: null,
          lastCaptures: []
        }
      };
    }),
    players: _.map(gameObject.players, function(player) {
      return {
        lastSyncDate: Date.now(),
        userId: player.userId,
        score: 0,
        stats: {
          timeSpentOnCaptures: 0,
          totalCaptureTries: 0,
          succeededCaptures: 0,
          failedCaptures: 0
        }
      };
    }),
    gameStartTime: Date.now(),
    // 1000 * 60 * 20 or 1000 * 60
    gameLength: gameObject.settings.gameTime > 20 ? 1200000 : gameObject.settings.gameTime * 60000
  };
  gameObject.progress = gameProgress;
  gameObject.state = 'started';
  setupGameLoops(gameObject);
  syncGame(gameObject);
  return gameObject;
}

module.exports = {
  factory: gameFactory,
  get: getGame,
  start: startGame,
  sync: syncGame,
  cleanup: cleanAfterGame,
  synchronize: synchronizeGameObject,
  update: updateGameObjectProgress
};
