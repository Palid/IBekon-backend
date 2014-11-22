'use strict';

module.exports = {
  db: "mongodb://localhost/IBekon-dev",
  app: {
    name: "IBekon DEV"
  },
  facebook: {
    clientID: "TODO",
    clientSecret: "TODO",
    callbackURL: "localhost:3000/auth/facebook/callback"
  },
  twitter: {
    clientID: "TODO",
    clientSecret: "TODO",
    callbackURL: "localhost:3000/auth/twitter/callback"
  },
  github: {
    clientID: "TODO",
    clientSecret: "TODO",
    callbackURL: "localhost:3000/auth/github/callback"
  },
  google: {
    clientID: "TODO",
    clientSecret: "TODO",
    callbackURL: "localhost:3000/auth/google/callback"
  },
  reddit: {
    clientID: "TODO",
    clientSecret: "TODO",
    callbackURL: "localhost:3000/auth/google/callback"
  }
};
