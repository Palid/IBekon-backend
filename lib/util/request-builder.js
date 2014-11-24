"use strict";

function getSingleRequest(obj) {
  return JSON.stringify(obj) + '\n\r';
}

function errorBuilder(command, description) {
  return getSingleRequest({
    status: "ERR",
    description: description,
    command: command,
    date: Date.now()
  });
}

module.exports = {
  error: errorBuilder,
  single: getSingleRequest
};


