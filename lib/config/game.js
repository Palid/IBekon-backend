"use strict";

module.exports = {
  port: process.env.VCAP_APP_PORT || 8069,
  host: process.env.VCAP_APP_HOST || 'localhost',
  allowHalfOpen: false,
  gameDefaults: {
    captureTime: 5, //seconds
    afterCaptureDelay: 10, //seconds
    gameTime: 10, //minutes
    victoryPoints: 10000,
    pointsPerTick: 10,
    tickPeriod: 10,
    maxPlayers: 2
  }
};
