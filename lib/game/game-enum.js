'use strict';

const enumUtils = require('../util/enum-utils.js');

const gameEnum = enumUtils.getEnumObject({
  LOBBY: 0,
  IN_PROGRESS: 1,
  FINISHED: 2
});

module.exports = gameEnum;
