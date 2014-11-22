'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;


/**
 * Record schema
 */
var GameSchema = new Schema({
  beacons: [{
    beaconID: String,
    owner: String,
    timeSinceCapture: Date,
    lastMovement: Date,
    timeSinceLastMovement: Date
  }],
  players: [{
    playerID: String,
    score: Number,
  }],
  state: {
    lastSync: {
      time: Date,
      beaconsStatus: [{
        time: Date,
        status: String,
        beaconID: String
      }],
      playersStatus: [{
        time: Date,
        status: String,
        playerID: String
      }]
    }
  }
});


mongoose.model('Game', GameSchema);
