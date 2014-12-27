"use strict";


// mitm dependencies start
jest.dontMock("net");
jest.dontMock("tls");
jest.dontMock("http");
jest.dontMock("https");
jest.dontMock("events");
jest.dontMock("stream");
// mitm dependencies end

jest.dontMock('lodash');
jest.dontMock('../config/game.js');
jest.dontMock('../game.js');
jest.dontMock('../core.js');
jest.dontMock('../util/request.js');

var _ = require('lodash');
var net = require('net');

var requestUtil = require('../util/request.js');
var config = require('../config/game.js');

var MOCKS = {
  HOST: '{"response":{"gameId":"mockedID","host":"myUserID","state":"lobby","settings":{"captureTime":5,"afterCaptureDelay":10,"gameTime":10,"victoryPoints":10000,"pointsPerTick":10,"tickPeriod":10,"maxPlayers":2},"beacons":[],"players":[{"userId":"myUserID","ready":false}]},"date":12345,"command":"HOST","status":"OK"}'
};


function errorBuilder(command, description) {
  return requestUtil.error(command, description).trim();
}


function socketSetup(context, player) {
  if (!player) player = 'p1';
  runs(function() {
    context[player].on('data', function(data) {
      context.response[player] = data;
    });
  });

  waitsFor(function() {
    return context.response[player];
  }, "Server should respond with an error in 100ms.", 100);
}

function connectUser(context, callback, player) {
  player = player ? player : 'p1';
  runs(function() {
    context.splitted[player] = requestUtil.splitter(context.response[player]);
    // Uses JSON.stringify isntead of requestUtil.single, because
    // requestUtil.single just adds \n to the end of the JSON.
    expect(context.splitted[player][0]).toEqual(JSON.stringify({
      status: "OK",
      date: Date.now()
    }));
    if (callback) callback();
  });

  context[player].write(requestUtil.build({
    command: "CONNECT",
    request: {
      userId: player === 'p1' ? "myUserID" : "myUserID" + player
    }
  }));
}

function connectAndHostGame(context, callback, player) {
  player = player ? player : 'p1';
  connectUser(context, function() {
    expect(context.splitted[player][1]).toEqual(MOCKS.HOST);
    if (callback) callback();
  }, player);
}

describe('Socket', function() {
  require('../core.js');
  // Require core

  beforeEach(function() {
    Date.now = function() {
      return 12345;
    };
    // player1
    this.p1 = net.connect(config.port, config.host);
    this.p1.setEncoding('utf8');
    // player2
    this.p2 = net.connect(config.port, config.host);
    this.p2.setEncoding('utf8');
    this.response = {};
    this.splitted = {};
  });

  afterEach(function() {
    this.p1.destroy();
    this.p1 = null;
    this.p2.destroy();
    this.p2 = null;
  });

  describe('fail-safe', function() {
    it('should return an undefined error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error(undefined, "Invalid request or data is not a valid JSON."));
      });
      this.p1.write('I Is Not A JSON');
    });

    it('should return a wrong request error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error(undefined, "Invalid request or data is not a valid JSON."));
      });
      this.p1.write('{"something": 123}');
    });

    it('should return an error if first command is not CONNECT', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "You have provided wrong command."));
      });
      this.p1.write(requestUtil.build({
        command: "IJustWantToCrash_thisSerVer",
        request: {
          userId: "MY-ID"
        }
      }));
    });

    it('should ignore wrong command and send an error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "Invalid request or data is not a valid JSON."));
      });
      this.p1.write(requestUtil.build({
        command: "IJustWantToCrash_thisSerVer"
      }));
    });

    it('should ignore wrong data', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error(undefined, "You have provided wrong command."));
      });
      this.p1.write(requestUtil.build({
        request: "213213"
      }));
    });
  });

  describe('CONNECT command', function() {

    it('should return a wrong request error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error("CONNECT", "Invalid request or data is not a valid JSON."));
      });
      this.p1.write(requestUtil.build({
        command: "CONNECT"
      }));
    });

    it('should return a "No user ID" error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response.p1).toEqual(requestUtil.error("CONNECT", "No userID provided."));
      });
      this.p1.write(requestUtil.build({
        command: "CONNECT",
        request: {
          test: "asdf"
        }
      }));
    });

    it('should return OK if userId is sent in request', function() {
      socketSetup(this);
      connectUser(this);
    });

    it('should return an error if userId is sent in request and it is set already', function() {
      var self = this;
      socketSetup(this);
      connectUser(this, function() {
        expect(self.splitted.p1[1]).toEqual(errorBuilder("CONNECT", "userID has already been set by this client."));
      });
      this.p1.write(requestUtil.build({
        command: "CONNECT",
        request: {
          userId: "myOtherUserID"
        }
      }));

    });
  });

  describe('HOST command', function() {

    it('should return game object', function() {
      socketSetup(this);
      connectAndHostGame(this);
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
    });

    it('should return an AUTH error if command was sent before authorizing', function() {
      socketSetup(this);
      runs(function() {
        this.splitted = {};
        this.splitted.p1 = requestUtil.splitter(this.response.p1);
        expect(this.splitted.p1[0]).toEqual(errorBuilder("HOST", "You have to authorize by CONNECT first."));
      });
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
    });

    it('should return already initialized error', function() {
      var self = this;
      socketSetup(this);
      connectAndHostGame(this, function() {
        expect(self.splitted.p1[2]).toEqual(errorBuilder("HOST", "Game with this userId is already initialied."));
      });
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));

      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
    });

  });

  describe('JOIN command', function() {

    it('should return an error if user is not authorized', function() {
      socketSetup(this);
      runs(function() {
        this.splitted = {};
        this.splitted.p1 = requestUtil.splitter(this.response.p1);
        expect(this.splitted.p1[0]).toEqual(errorBuilder("JOIN", "You have to authorize by CONNECT first."));
      });
      this.p1.write(requestUtil.build({
        command: "JOIN",
        request: {}
      }));
    });

    it('should return an error if game is not found', function() {
      var self = this;
      socketSetup(this);
      connectUser(this, function() {
        expect(self.splitted.p1[1]).toEqual(errorBuilder('JOIN', 'Game not found.'));
      });
      this.p1.write(requestUtil.build({
        command: "JOIN",
        request: {
          gameId: '123213213'
        }
      }));
    });

    it('should return an error if player that already hosts would want to join any other game', function() {
      var self = this;
      socketSetup(this);

      connectAndHostGame(this, function() {
        expect(self.splitted.p1[2]).toEqual(errorBuilder('JOIN', "You can't join a game while hosting one."));
      });
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
      this.p1.write(requestUtil.build({
        command: "JOIN",
        request: {
          gameId: "mockedID"
        }
      }));
    });

    it('should allow p2 to join a hosted game', function() {
      var self = this;
      socketSetup(this, 'p1');

      connectAndHostGame(this);
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
      socketSetup(this, 'p2');
      connectUser(this, function() {
        expect(self.splitted.p2[1]).toEqual('{"response":{"gameId":"mockedID","host":"myUserID","state":"lobby","settings":{"captureTime":5,"afterCaptureDelay":10,"gameTime":10,"victoryPoints":10000,"pointsPerTick":10,"tickPeriod":10,"maxPlayers":2},"beacons":[],"players":[{"userId":"myUserID","ready":false},{"userId":"myUserIDp2","ready":false}]},"date":12345,"command":"JOIN","status":"OK"}');
      }, 'p2');
      this.p2.write(requestUtil.build({
        command: "JOIN",
        request: {
          gameId: "mockedID"
        }
      }));
    });
  });

});
