'use strict';

const stampit = require('stampit');
const Promise = require('bluebird');

const BeaconEnum = require('./BeaconEnum.js');

const Beacon = stampit({
  init: function() {
  },
  methods: {
    capture() {
      // empty for the moment
    },
    startCapturing() {
      // empty for the moment
    }
  },
  refs: {
    id: null,
    lastAccessTime: null,
    inGame: null,
    lastCaptureTime: null,
    state: null
  }
}).compose(BeaconEnum);


module.exports = Beacon;
