"use strict";

module.exports = {
  port: process.env.VCAP_APP_PORT || 8069,
  host: process.env.VCAP_APP_HOST || 'localhost',
  allowHalfOpen: false
};
