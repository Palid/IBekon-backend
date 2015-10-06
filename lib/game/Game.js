'use strict';

const _ = require('lodash');
const stampit = require('stampit');
const liteId = require('lite-id');

const gameCache = require('./game-cache.js');

// FIXME probably.
const config = require('../config/game-defaults.js');

const Game = stampit({
  init: function() {
    if (!this.host) {
      throw new Error('Game host wasn\'t provided.');
    }
    this.gameId = liteId();
    gameCache.setCurrentGame(this.gameid, this)
      .then(function() {
        // lel idk?
      })
      .error(function() {
        // lel idk more?
      });
    // Sanity checks
  },
  props: {
    state: 'lobby',
    settings: config.gameDefaults,
    beacons: [],
    players: [],
    sys: {}
  },
  refs: {
    gameId: null,
    host: null
  }
});

const test = Game({
  host: 'dupa'
});
// const test2 = Game();

module.exports = Game;
