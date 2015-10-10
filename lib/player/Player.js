'use strict';

const stampit = require('stampit');
const Promise = require('bluebird');

const Player = stampit({
  refs: {
    id: null,
    isHost: null,
    inGame: null
  }
});


module.exports = Player;
