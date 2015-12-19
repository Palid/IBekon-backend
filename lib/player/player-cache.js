'use strict';

const _ = require('lodash');
const stampit = require('stampit');
const Promise = require('bluebird');

const PlayerCache = stampit({
  init: function() {
    this.currentPlayers = new Map();
  },
  methods: {
    getPlayer(playerId) {
      const self = this;
      return new Promise(function(resolve, reject) {
        const currentPlayer = self.currentPlayers.get(playerId);
        if (currentPlayer) {
          resolve(currentPlayer);
        } else {
          reject(`Could not find a player with ID of '${playerId}'.`);
        }
      });
    },
    updatePlayer(playerId, player) {
      const self = this;
      return new Promise(function(resolve, reject) {
        if (self.currentPlayers.has(playerId)) {
          _.extend(self.currentPlayers[playerId], player);
          resolve(player);
        } else {
          reject(`Player with provided ID of '${playerId}' does not exist.`);
        }
      });
    }
  }
});

const playerCacheSingleton = PlayerCache();

module.exports = playerCacheSingleton;
