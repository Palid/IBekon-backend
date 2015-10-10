'use strict';

const stampit = require('stampit');
const Promise = require('bluebird');

const BeaconEnum = stampit({
  refs: {
    STATES: {
      neutral: 0,
      inCapture: 1,
      captured: 2
    }
  }
});


module.exports = BeaconEnum;
