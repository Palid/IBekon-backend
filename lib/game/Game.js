'use strict';

const _ = require('lodash');
const stampit = require('stampit');
const liteId = require('lite-id');

const gameCache = require('./game-cache.js');
const gameEnum = require('./game-enum.js');
// FIXME probably.
const config = require('../config/game-defaults.js');

const EventEmitter = require('../common/EventEmitter.js');

const Game = stampit({
  init() {
    if (!this.host) {
      throw new Error('Game host wasn\'t provided.');
    }
    this.state = gameEnum.LOBBY;
    this.id = liteId();
    // Need to add after init, because it won't work otherwise.
    this.beacons = new Map();
    this.players = new Map();
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
    sys: {}
  },
  refs: {
    id: null,
    host: null,
    state: null,
    currentLeader: null //player object
  },
  methods: {
    addPlayer(player) {
      var id = player.id;
      if (this.state !== gameEnum.LOBBY) {
        throw new Error('Game already started. Cannot add additional players.');
      }
      if (this.players.has(id)) {
        throw new Error(`Player with ID of ${id} already exists in the current game.`);
      } else {
        this.player.add(player);
        player.inGame = this;
      }
      return this;
    },
    sync() {

    },
    setup() {
      this.sys.syncInterval = setInterval(_.bind(this.sync, this), 1000);
    },
    start() {
      if (this.state !== gameEnum.LOBBY) {
        throw new Error(`Cannot start the game. Game's current state is: ${gameEnum[this.state]}`);
      }
      this.state = gameEnum.IN_PROGRESS;
    },
    findBeacon(beaconId) {
      const beacon = this.beacons.get(beaconId);
      if (!beacon) {
        throw new Error(`Could not find beacon with ID of ${beaconId} in current game with ID of ${this.id}`);
      } else {
        return beacon;
      }
    },
    findPlayer(playerId) {
      const player = this.players.get(beaconId);
      if (!player) {
        throw new Error(`Could not find player with ID of ${playerId} in current game with ID of ${this.id}`);
      } else {
        return player;
      }
    }
  }
}).compose(EventEmitter);

module.exports = Game;
