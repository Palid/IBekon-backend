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
jest.dontMock('../util/request-builder.js');

// var _ = require('lodash');
// var shortID = require('short-id');
// var mitmModule = require('mitm');
var net = require('net');

var requestBuilder = require('../util/request-builder');
var config = require('../config/game.js');

describe('Socket', function() {
  // Require core
  require('../core.js');

  beforeEach(function() {
    Date.now = function() {
      return 12345;
    };
    this.socket = net.connect(config.port, config.host);
    this.socket.setEncoding('utf8');
  });

  afterEach(function() {
    this.socket.destroy();
    this.socket = null;
  });

  it('should return INVALID_JSON error', function() {
    var response;
    runs(function() {
      this.socket.on('data', function(data) {
        response = data;
      });
    });

    waitsFor(function() {
      return response;
    }, "Server should respond with an error in 20ms.", 20);

    runs(function() {
      expect(response).toEqual(requestBuilder.error(undefined, "Couldn't parse JSON."));
    });

    this.socket.write('I Is Not A JSON');
  });

  it('should return a wrong request error', function() {
    var response;
    runs(function() {
      this.socket.on('data', function(data) {
        response = data;
      });
    });

    waitsFor(function() {
      return response;
    }, "Server should respond with an error in 20ms.", 20);
    runs(function() {
      expect(response).toEqual(requestBuilder.error(undefined, "Wrong request!"));
    });
    this.socket.write('{"something": 123}');
  });

  it('should return an error if first command is not CONNECT', function() {
    var response;
    runs(function() {
      this.socket.on('data', function(data) {
        response = data;
      });
    });

    waitsFor(function() {
      return response;
    }, "Server should respond with an error in 20ms.", 20);
    runs(function() {
      expect(response).toEqual(requestBuilder.error("IJustWantToCrash_thisSerVer", "You have provided wrong command."));
    });
    this.socket.write(requestBuilder.single({
      command: "IJustWantToCrash_thisSerVer",
      request: {
        userId: "MY-ID"
      }
    }));
  });
});
