"use strict";
/**
 * @requestBuilder utility
 * @module  util/request-builder
 * @author Dariusz 'Palid' Niemczyk
 */

/**
 * Formats object to socket-writable JSON that ends with '\n'
 * @param  {object} obj Object that's going to be stringifed
 * @return {string}     Stringified and formatted socket-writable object
 */
function socketableJSONFormatter(obj) {
  return JSON.stringify(obj) + '\n';
}

/**
 * Creates stringified error object
 * @param  {string} command     Player invoked command
 * @param  {string} description Error's description
 * @return {string}             Stringified and formatted socket-writable error object
 */
function errorBuilder(command, description) {
  return socketableJSONFormatter({
    status: "ERR",
    description: description,
    command: command,
    date: Date.now()
  });
}

module.exports = {
  error: errorBuilder,
  single: socketableJSONFormatter
};


