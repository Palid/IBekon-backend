'use strict';

const _ = require('lodash');
const stampit = require('stampit');
const liteId = require('lite-id');

const gameCache = require('./game-cache.js');
const GameEnum = require('./GameEnum.js');
// FIXME probably.
const config = require('../config/game-defaults.js');

const Game = stampit({
  init: function() {
    if (!this.host) {
      throw new Error('Game host wasn\'t provided.');
    }
    this.state = this.STATES[0];
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
    settings: config.gameDefaults,
    beacons: new Map(),
    players: new Map(),
    sys: {}
  },
  refs: {
    gameId: null,
    host: null,
    state: null
  },
  methods: {
    addPlayer(player) {
      var id = player.id;
      if (this.players.has(id)) {
        throw new Error(`Player with ID of ${id} already exists in the current game.`);
      } else {
        this.player.add(player);
      }
      return this;
    }
  }
}).compose(GameEnum);

module.exports = Game;
