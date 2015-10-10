'use strict';

const stampit = require('stampit');


const GameEnum = stampit({
  refs: {
    STATE: {
      lobby: 0,
      starting: 1,
      inProgress: 2,
      finished: 3
    }
  }
});


module.exports = GameEnum;
