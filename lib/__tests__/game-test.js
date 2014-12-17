"use strict";

jest.dontMock('lodash');
jest.dontMock('../game.js');
jest.dontMock('../util/request.js');

var _ = require('lodash');
var requestUtil = require('../util/request');

var MOCKS = {
  game: {
    gameId: "mockedID",
    settings: {
      captureTime: 5,
      afterCaptureDelay: 10,
      gameTime: 10,
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
    socket: {
      write: function() {
        return true;
      }
    },
    ready: true
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
        sys: {
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
      gameLength: 600000
    }
  }
);

var RESPONSEMOCK = {
  command: 'SYNC',
  response: {
    beacons: [{
      beaconId: '12345',
      state: 'captured',
      owner: 'neutral',
      currentCapturingTime: 0,
      movementLockTime: 0
    }],
    players: [{
      lastSyncDate: 12345,
      userId: '12345',
      score: 0,
      stats: {
        timeSpentOnCaptures: 0,
        totalCaptureTries: 0,
        succeededCaptures: 0,
        failedCaptures: 0
      }
    }, {
      lastSyncDate: 12345,
      userId: '12345',
      score: 0,
      stats: {
        timeSpentOnCaptures: 0,
        totalCaptureTries: 0,
        succeededCaptures: 0,
        failedCaptures: 0
      }
    }],
    gameStartTime: 12345,
    gameLength: 600000
  },
  status: 'OK',
  date: 12345
};

function createGame(Game) {
  var newGame = Game.create("MYHOST");
  expect(newGame).toEqual(MOCKS.game);
  return newGame;
}

function startGame(Game, newGame) {
  if (!newGame) newGame = createGame(Game);
  newGame.players.push(MOCKS.player);
  newGame.beacons.push(MOCKS.beacon);
  Game.start(newGame);
  return newGame;
}

describe('Game', function() {
  var Game;
  beforeEach(function() {
    Game = require('../game.js');
    Date.now = function() {
      return 12345;
    };
  });

  it("should create a new game with default settings and MYHOST as host", function() {
    createGame(Game);
  });

  it("should return game instance if game was found", function() {
    createGame(Game);
    expect(Game.get('mockedID')).toEqual(MOCKS.game);
  });

  it("should return an error if game with provided ID doesn't exit", function() {
    var ERR = new Error();
    ERR.status = 404;
    ERR.description = "Game not found!";
    expect(Game.get("I'm pretty sure this ID doesn't exist.")).toEqual(ERR);
  });

  it("should start the game and override current object", function() {
    var newGame = startGame(Game);
    // remove game loops
    newGame.sys = {};
    expect(newGame).toEqual(MOCKS.progress);
  });

  it("should have timers set up after game start", function() {
    var newGame = startGame(Game);
    expect(newGame.sys).not.toEqual(MOCKS.progress.sys);
    expect(newGame.sys.scoreInterval).not.toBeUndefined();
    expect(newGame.sys.syncInterval).not.toBeUndefined();
  });

  it("should clean up after game's finished", function() {
    var newGame = startGame(Game);
    Game.cleanup(newGame);
    expect(newGame).toEqual(MOCKS.progress);
  });

  it("should call SYNC (write to game socket) immidiately after startGame", function() {
    var newGame = createGame(Game);
    newGame.players.push(MOCKS.player);
    spyOn(newGame.players[0].socket, 'write');
    startGame(Game, newGame);
    expect(newGame.players[0].socket.write).toHaveBeenCalled();
    expect(newGame.players[0].socket.write.calls.length).toEqual(2);
    expect(newGame.players[0].socket.write.mostRecentCall.args[0]).toEqual(requestUtil.build(RESPONSEMOCK));
  });

});
