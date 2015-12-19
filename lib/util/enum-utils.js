'use strict';

const _ = require('lodash');

const defaultEnumOptions = {
  writable: false,
  enumerable: true,
  configurable: false
};

module.exports = {
  getEnumObject(enumObject) {
    let enumObj = {};
    _.forEach(enumObject, function(value, key) {
      enumObj[value] = _.extend({
        value: key,
      }, defaultEnumOptions);
      enumObj[key] = _.extend({
        value: key
      }, defaultEnumOptions);
    });
    return Object.freeze(enumObj);
  }
};
