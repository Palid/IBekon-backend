'use strict';

const _ = require('lodash');
const stampit = require('stampit');
const Promise = require('bluebird');
const moment = require('moment');

const EventEmitter = require('../common/EventEmitter.js');
const beaconEnum = require('./beacon-enum.js');

function statsDecorator(player) {
  const stats = this.stats;
  const currentDate = moment();
  stats.lastCapture = {
    player: player,
    date: currentDate
  };
  if (!stats.firstCapturedBy) {
    stats.firstCapturedBy = player;
  }
}

function afterCapture(player) {
  statsDecorator.call(this, player);
  this.owner = player;
  this.state = beaconEnum.CAPTURED;
  this.sys.captureTimeout = null;
  _.last(this.allCaptures).captured = true;
  this.emit('beacon:captured', player);
  this._captured(player);
}

function scoreBeacon(player) {
  this.emit('beacon:scored', player);
}

const Beacon = stampit({
  init() {
    this.stats = new Map();
  },
  methods: {
    _captured(player) {
      this.sys.pointsTicker = setInterval(() => scoreBeacon(player), this.config.pointsTickTime);
      return this;
    },
    capture(player) {
      const currentDate = moment();
      this.stats.lastAccessTime = currentDate;
      this.state = beaconEnum.inCapture;
      clearInterval(this.sys.pointsTicker);
      this.sys.pointsTicker = null;
      this.sys.captureTimeout = setTimeout(_.bind(afterCapture, this, player), this.config.timeToCapture);
      this.allCaptures.push({
        player: player,
        date: currentDate,
        captured: false
      });
      return this;
    },
    clearIntervals() {
      _.forEach(this.sys, function(interval, key) {
        if (interval) {
          clearInterval(interval);
          this.sys[key] = null;
        }
      });
      return this;
    },
    destroy() {
      this.clearIntervals()
        .removeAllListeners();
    }
  },
  refs: {
    id: null,
    game: null,
    state: null,
    owner: null,
    allCaptures: [],
    sys: {
      captureTimeout: null,
      pointsTicker: null
    },
    // I need to provide defaults for each beacon.
    // Let's say those are each beacon defaults unless overriden.
    config: {
      pointsTickTime: 1000,
      pointsPerTick: 1,
      timeToCapture: 5000,
    },
    stats: {
      lastAccessTime: null,
      lastCapture: {
        player: null,
        date: null
      },
      // this one needs to be updated in the automagic loop
      longestInHold: null,
      firstCapturedBy: null
    }
  }
}).compose(EventEmitter);

module.exports = Beacon;
