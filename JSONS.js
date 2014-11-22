//JOIN/HOST STATUS
{
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
}


{
  "status": "ERR",
  "response": {

  }
}


// Game start
//
{
  "userId": "123213",
  "status": "ready",
  "game": "started"
}


//Client's Immediate response to server
{
  "status" : "OK",
  "response": {
    "gameId": "sadsad",
    "userId": "sadsadsad"
  }
}
