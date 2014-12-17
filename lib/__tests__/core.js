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

describe('Socket', function() {
  require('../core.js');
  // Require core

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

  describe('fail-safe', function() {
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
        expect(response).toEqual(requestUtil.error(undefined, "Couldn't parse JSON."));
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
        expect(response).toEqual(requestUtil.error(undefined, "Wrong request!"));
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
        expect(response).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "You have provided wrong command."));
      });
      this.socket.write(requestUtil.build({
        command: "IJustWantToCrash_thisSerVer",
        request: {
          userId: "MY-ID"
        }
      }));
    });

    it('should ignore wrong command and send an error', function() {
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
        expect(response).toEqual(requestUtil.error("IJustWantToCrash_thisSerVer", "Wrong request!"));
      });
      this.socket.write(requestUtil.build({
        command: "IJustWantToCrash_thisSerVer"
      }));
    });

    it('should ignore wrong data', function() {
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
        expect(response).toEqual(requestUtil.error(undefined, "You have provided wrong command."));
      });
      this.socket.write(requestUtil.build({
        request: "213213"
      }));
    });
  });

  describe('CONNECT command', function() {

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
        expect(response).toEqual(requestUtil.error("CONNECT", "Wrong request!"));
      });
      this.socket.write(requestUtil.build({
        command: "CONNECT"
      }));
    });

    it('should return a "No user ID" error', function() {
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
        expect(response).toEqual(requestUtil.error("CONNECT", "No userID provided."));
      });
      this.socket.write(requestUtil.build({
        command: "CONNECT",
        request: {
          test: "asdf"
        }
      }));
    });

    it('should return OK if userId is sent in request', function() {
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
        expect(response).toEqual(requestUtil.build({
          status: "OK",
          date: Date.now()
        }));
      });

      this.socket.write(requestUtil.build({
        command: "CONNECT",
        request: {
          userId: "myUserID"
        }
      }));
    });

    it('should return an error if userId is sent in request and it is set already', function() {
      var socket = this.socket,
        response;
      runs(function() {
        this.socket.on('data', function(data) {
          response = data;
        });
      });
      waitsFor(function() {
        return response;
      }, "Server should respond with an error in 200ms.", 200);
      runs(function() {
          expect(requestUtil.splitter(response)[0]).toEqual(JSON.stringify({
            status: "OK",
            date: Date.now()
          }));
          expect(requestUtil.splitter(response)[1]).toEqual(requestUtil.error("CONNECT",  "userID has already been set by this client.").trim());
      });
      socket.write(requestUtil.build({
        command: "CONNECT",
        request: {
          userId: "myUserID"
        }
      }));
      socket.write(requestUtil.build({
        command: "CONNECT",
        request: {
          userId: "myOtherUserID"
        }
      }));

    });


  });

});
