'use strict';


const enumUtils = require('../util/enum-utils.js');

const beaconEnum = enumUtils.getEnumObject({
  NEUTRAL: 0,
  IN_CAPTURE: 1,
  CAPTURED: 2
});

module.exports = beaconEnum;
