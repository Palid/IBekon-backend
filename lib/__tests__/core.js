"use strict";


jest.dontMock('mitm');
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
// var shortID = require('short-id');
// var mitmModule = require('mitm');
var net = require('net');

var requestUtil = require('../util/request.js');
var config = require('../config/game.js');

function socketSetup(context, player) {
  player = player ? player : 'p1';
  runs(function() {
    context[player].on('data', function(data) {
      context.response = data;
    });
  });

  waitsFor(function() {
    return context.response;
  }, "Server should respond with an error in 20ms.", 20);
}

function connectUser(context, callback, player) {
  player = player ? player : 'p1';
  runs(function() {
    context.splitted = requestUtil.splitter(context.response);
    // Uses JSON.stringify isntead of requestUtil.single, because
    // requestUtil.single just adds \n to the end of the JSON.
    expect(context.splitted[0]).toEqual(JSON.stringify({
      status: "OK",
      date: Date.now()
    }));
    if (callback) callback();
  });

  context[player].write(requestUtil.build({
    command: "CONNECT",
    request: {
      userId: "myUserID"
    }
  }));
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
        expect(this.response).toEqual(requestUtil.error(undefined, "Couldn't parse JSON."));
      });
      this.p1.write('I Is Not A JSON');
    });

    it('should return a wrong request error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response).toEqual(requestUtil.error(undefined, "Wrong request!"));
      });
      this.p1.write('{"something": 123}');
    });

    it('should return an error if first command is not CONNECT', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "You have provided wrong command."));
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
        expect(this.response).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "Wrong request!"));
      });
      this.p1.write(requestUtil.build({
        command: "IJustWantToCrash_thisSerVer"
      }));
    });

    it('should ignore wrong data', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response).toEqual(requestUtil.error(undefined, "You have provided wrong command."));
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
        expect(this.response).toEqual(requestUtil.error("CONNECT", "Wrong request!"));
      });
      this.p1.write(requestUtil.build({
        command: "CONNECT"
      }));
    });

    it('should return a "No user ID" error', function() {
      socketSetup(this);
      runs(function() {
        expect(this.response).toEqual(requestUtil.error("CONNECT", "No userID provided."));
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
        expect(self.splitted[1]).toEqual(requestUtil.error("CONNECT", "userID has already been set by this client.").trim());
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
      var self = this;
      socketSetup(this);
      connectUser(this, function() {
        expect(self.splitted[1]).toEqual('{"response":{"date":12345,"gameId":"mockedID","host":"myUserID","state":"lobby","settings":{"captureTime":5,"afterCaptureDelay":10,"gameTime":10,"victoryPoints":10000,"pointsPerTick":10,"tickPeriod":10,"maxPlayers":2},"beacons":[],"players":[{"userId":"myUserID","ready":false}],"sys":{}},"command":"HOST","status":"OK"}');
      });
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
    });

    it('should return an AUTH error if command was sent before authorizing', function() {
      socketSetup(this);
      runs(function() {
        this.splitted = requestUtil.splitter(this.response);
        expect(this.splitted[0]).toEqual(requestUtil.error("HOST", "You have to authorize by CONNECT first.").trim());
      });
      this.p1.write(requestUtil.build({
        command: "HOST",
        request: {}
      }));
    });

    it('should return already initialized error', function() {
      var self = this;
      socketSetup(this);
      connectUser(this, function() {
        expect(self.splitted[1]).toEqual('{"response":{"date":12345,"gameId":"mockedID","host":"myUserID","state":"lobby","settings":{"captureTime":5,"afterCaptureDelay":10,"gameTime":10,"victoryPoints":10000,"pointsPerTick":10,"tickPeriod":10,"maxPlayers":2},"beacons":[],"players":[{"userId":"myUserID","ready":false}],"sys":{}},"command":"HOST","status":"OK"}');
        expect(self.splitted[2]).toEqual(requestUtil.error("HOST", "Game with this userId is already initialied.").trim());
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


});
