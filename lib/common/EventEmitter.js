'use strict';

const events = require('events');
const stampit = require('stampit');

module.exports = stampit.convertConstructor(events.EventEmitter);
