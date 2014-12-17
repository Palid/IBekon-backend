"use strict";
/**
 * @requestBuilder utility
 * @module  util/request
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

/**
 * Splits received data into single objects
 * and for performance.
 * @param  {string} data Data received by socket connection
 * @return {array}      Separated and trimmed array of iterable objects
 */
function splitter(data) {
  var request = data.split('\n');
  var result = [];
  for (var i=0, len = request.length; i < len; i++) {
    var item = request[i];
    if (item !== '') result.push(item.trim());
  }
  return result;
}

module.exports = {
  error: errorBuilder,
  build: socketableJSONFormatter,
  splitter: splitter
};
