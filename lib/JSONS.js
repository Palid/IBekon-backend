"use strict";
//JOIN/HOST STATUS
var mock1 = {
  "status": "OK",
  "response": {
    "settings": {
      "beaconDelay": "10", //in seconds
      "gameTime": "120", //in seconds
      "victoryPoints": "1000",
      "pointsPerTick": "10",
      "tickPeriod": "10" //in seconds
    },
    "beacons": [{
      "id": "String",
      "alias": "String"
    }],
    "players": [{
      "nick": "String",
      "id": "ANDROIDUNIQUEUSERID"
    }],
    "host": "ANDROIDUNIQUEUSERID",
    "gameId": "ANDROIDUNIQUEUSERID"
  }
};


// Game start
//
var mock2 = {
  "userId": "123213",
  "status": "ready",
  "game": "started"
};


//Client's Immediate response to server
var mock3 = {
  "status" : "OK",
  "response": {
    "gameId": "sadsad",
    "userId": "sadsadsad"
  }
};

module.exports = {
  mocks: [mock1, mock2, mock3]
};
