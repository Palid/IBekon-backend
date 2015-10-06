'use strict';

const stampit = require('stampit');
const Promise = require('bluebird');

const GameCache = stampit({
  init: function() {
    this.currentGames = new Map();
  },
  methods: {
    getCurrentGame(gameId) {
      var self = this;
      return new Promise(function(resolve, reject) {
        const currentGame = self.currentGames.get(gameId);
        if (currentGame) {
          resolve(currentGame);
        } else {
          reject(`Could not find a game with ID of '${gameId}'.`);
        }
      });
    },
    setCurrentGame(gameId, game) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!self.currentGames.has(gameId)) {
          self.currentGames.set(gameId, game);
          resolve(game);
        } else {
          reject(`Game with provided ID of '${gameId}' already exists in the cache.`);
        }
      });
    }
  }
});

const gameCacheSingleton = GameCache();

module.exports = gameCacheSingleton;
