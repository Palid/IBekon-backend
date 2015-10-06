'use strict';

jest.dontMock('../game-cache.js');
const gameCache = require('../game-cache.js');

describe('gameCache singleton', function() {
  beforeEach(function() {
    // mock map
    gameCache.currentGames = new Map();
  });
  pit('should return an error in promise when game with provided ID is not found', function() {
    return gameCache.getCurrentGame('123').catch(function(err) {
      expect(err).toBe('Could not find a game with ID of \'123\'.');
    });
  });
  pit('should return the game object in promise if it exists', function() {
    const mock = {mock: 'mock'};
    gameCache.currentGames.set(1, mock);
    return gameCache.getCurrentGame(1).then(function(game) {
      expect(game).toBe(mock);
    });
  });
  pit('should return an error in promise when game with provided ID already exists', function() {
    const testId = 'testid';
    const mock = {mock: 'mock'};
    gameCache.currentGames.set(testId, mock);
    return gameCache.setCurrentGame(testId, mock).catch(function(err) {
      expect(err).toBe('Game with provided ID of \'testid\' already exists in the cache.');
    });
  });
  pit('should return game object if setting game object to cache succeeded', function() {
    var mock = 'potato';
    return gameCache.setCurrentGame('myTest', mock).then(function(game) {
      expect(game).toBe(mock);
    });
  });
});
