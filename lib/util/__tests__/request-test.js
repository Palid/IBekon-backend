"use strict";

jest.dontMock('../request.js');


describe('request util', function() {
  var requestBuilder;
  beforeEach(function() {
    requestBuilder = require('../request.js');
    // Date.now mock
    Date.now = function() {
      return 123456;
    };
  });
  it('creates a JSON with newline at the end', function() {
    var mock = {
      status: 'OK',
      response: {
        settings: {
          beaconDelay: 10, //in seconds
          gameTime: 120, //in seconds
          victoryPoints: 1000,
          pointsPerTick: 10,
          tickPeriod: 10 //in seconds
        },
        beacons: [{
          id: "string",
          alias: "string"
        }],
        players: [{
          nick: "string",
          id: 'ANDROIDUNIQUEUSERID'
        }],
        host: 'ANDROIDUNIQUEUSERID',
        gameId: 'ANDROIDUNIQUEUSERID'
      }
    };
    expect(requestBuilder.build(mock)).toBe('{"status":"OK","response":{"settings":{"beaconDelay":10,"gameTime":120,"victoryPoints":1000,"pointsPerTick":10,"tickPeriod":10},"beacons":[{"id":"string","alias":"string"}],"players":[{"nick":"string","id":"ANDROIDUNIQUEUSERID"}],"host":"ANDROIDUNIQUEUSERID","gameId":"ANDROIDUNIQUEUSERID"}}\n');
  });
  it('creates a JSON with error status', function() {
    expect(requestBuilder.error('TEST', 'NO SIR NO WORK')).toBe('{"status":"ERR","description":"NO SIR NO WORK","command":"TEST","date":123456}\n');
  });
  it('creates a new array from separated by newline JSON strings', function() {
    var mock = requestBuilder.build({
      myone: 123,
      sth: 321
    }) + requestBuilder.build({
      a: [{
        b: 'c'
      }]
    });
    expect(requestBuilder.splitter(mock)).toEqual(['{"myone":123,"sth":321}','{"a":[{"b":"c"}]}']);
  });
});
