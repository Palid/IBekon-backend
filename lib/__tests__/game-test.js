"use strict";

jest.dontMock('lodash');
jest.dontMock('../game.js');
jest.dontMock('../util/request-builder.js');

var _ = require('lodash');

var MOCKS = {
  game: {
    gameId: "mockedID",
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
    host: "MYHOST",
    state: "lobby",
    sys: {}
  },
  player: {
    userId: '12345',
    socket: {}
  },
  beacon: {
    beaconId: '12345'
  }
};

MOCKS.progress = _.extend({},
  _.cloneDeep(MOCKS.game), {
    players: [MOCKS.player],
    beacons: [MOCKS.beacon],
    state: 'started',
    progress: {
      beacons: [{
        beaconId: '12345',
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
        system: {
          captureInterval: null,
          lastCaptures: []
        }
      }],
      players: [{
        userId: '12345',
        score: 0,
        stats: {
          timeSpentOnCaptures: 0,
          totalCaptureTries: 0,
          succeededCaptures: 0,
          failedCaptures: 0
        },
        lastSyncDate: 12345
      }],
      gameStartTime: 12345,
      gameLength: 1200000
    }
  }
);


function createGame(Game) {
  var newGame = Game.create("MYHOST");
  expect(newGame).toEqual(MOCKS.game);
  return newGame;
}

describe('Game', function () {
  var Game;
  beforeEach(function () {
    Game = require('../game.js');
    Date.now = function () {
      return 12345;
    };
  });

  it("should create a new game with default settings and MYHOST as host", function () {
    createGame(Game);
  });

  it("should return game instance if game was found", function () {
    createGame(Game);
    expect(Game.get('mockedID')).toEqual(MOCKS.game);
  });

  it("should return an error if game with provided ID doesn't exit", function () {
    var ERR = new Error();
    ERR.status = 404;
    ERR.description = "Game not found!";
    expect(Game.get("I'm pretty sure this ID doesn't exist.")).toEqual(ERR);
  });

  it("should start the game and override current object", function () {
    var newGame = createGame(Game);
    newGame.players.push(MOCKS.player);
    newGame.beacons.push(MOCKS.beacon);
    Game.start(newGame);
    expect(newGame).toEqual(MOCKS.progress);
  });
});
