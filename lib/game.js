"use strict";

var _ = require('lodash');
var shortID = require('short-id');

shortID.configure({
  length: 4, // The length of the id strings to generate
  algorithm: 'sha1', // The hashing algoritm to use in generating keys
  salt: Math.random // A salt value or function
});

var requestBuilder = require('./util/request-builder.js');

var currentGames = {};

function createGameObject(userId) {
  var gameId = shortID.generate();
  var game = {
    gameId: gameId,
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
  currentGames[gameId] = game;
  return game;
}

function getGame(gameId) {
  var checkedGame = currentGames[gameId];
  if (checkedGame) {
    return checkedGame;
  } else {
    var ERR = new Error();
    ERR.status = 404;
    ERR.description = "Game not found!";
    return ERR;
  }
}

function cleanAfterGame(gameObject) {
  if (gameObject) {
    _.forEach(gameObject.sys, function (gameInterval, key, collection) {
      clearInterval(gameInterval);
      delete collection[key];
    });
    if (gameObject.progress) {
      _.forEach(gameObject.beacons, function (beacon, key, collection) {
        if (beacon.interval) {
          clearInterval(beacon.interval);
          delete collection[key];
        }
      });
    }
  }
}

function syncGame(game) {
  var progress = _.transform(game.progress, function (result, item, key) {
    if (key === "beacons") {
      result[key] = _.map(item, function (beacon) {
        return _.transform(beacon, function (result, item, key) {
          if (key !== "system" && key !== "stats") {
            result[key] = item;
          }
        });
      });
    } else {
      result[key] = item;
    }
  });
  game.players.forEach(function (player) {
    var request = requestBuilder.single({
      command: "SYNC",
      response: progress,
      status: "OK",
      date: Date.now()
    });
    // coreLogger.log('info', request);
    player.socket.write(request);
  });
}

function setupGameLoops(gameObject) {
  gameObject.sys.scoreInterval = setInterval(function () {
    gameObject.progress.beacons.forEach(function (beacon) {
      if (beacon.owner !== 'neutral') {
        _.where(gameObject.progress.players, {
          userId: beacon.owner
        }).forEach(function (user) {
          user.score = gameObject.settings.pointsPerTick + user.score;
        });
      }
    });
  }, 1000 / 3);
  gameObject.sys.syncInterval = setInterval(function () {
    syncGame(gameObject);
    var victoriousPlayer = _.find(gameObject.progress.players, function (player) {
      return player.score >= gameObject.settings.victoryPoints;
    });
    if (((Date.now() - gameObject.progress.gameStartTime) > gameObject.progress.gameLength) || victoriousPlayer) {
      cleanAfterGame(gameObject);
    }
  }, 1000);
}

function startGame(gameObject) {
  var gameProgress = {
    beacons: _.map(gameObject.beacons, function (beacon) {
      return {
        // name: '',
        beaconId: beacon.beaconId,
        state: 'captured',
        owner: 'neutral',
        currentCapturingTime: 0,
        movementLockTime: 0,
        stats: {
          /**
           * allCaptures is an array storing all capture tries as objects
           * @type {Array}
           * @param {Object} capture log object
           * @param {String} userId   ID of player capturing the beacon
           * @param {Date} date Date.now()
           */
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
    players: _.map(gameObject.players, function (player) {
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
    gameLength: gameObject.settings.gameTime > 20 ? 1000 * 60 * 20 : gameObject.settings.gameTime * 1000 * 60
  };

  gameObject.progress = gameProgress;
  gameObject.state = 'started';
  setupGameLoops(gameObject);
}

module.exports = {
  create: createGameObject,
  get: getGame,
  start: startGame,
  sync: syncGame,
  cleanup: cleanAfterGame
};
