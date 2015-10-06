'use strict';
/**
 * @directoryLoader utility
 * @class
 * @module  util/load-directory
 * @author Dariusz 'Palid' Niemczyk
 * @requires lodash
 */
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const BANNED = [
  'index.js',
  '*example',
  'package.json',
  '*__'
];

function loadFile(targetDir, encoding) {
  const enc = encoding || 'utf-8';
  return fs.readFileSync(targetDir, enc);
}


/**
 * loadDirectory loads whole directory as an object and exports it from module
 * @param  {string}   fileList    List of all files(and directories) from current dir
 * @param  {string}   dir         Resolved path from which files will be required
 * @param  {object}   options     Options object
 * @param  {regexp}   options.re                regexp to match for files
 * @param  {boolean}  options.recursive        Should it go recursively over all directories
 * @param  {string}   options.type              File type/extension
 * @return {object}   Returns a dictionary of all required files.
 */
function loadDirectory(fileList, dir, options) {
  _.remove(fileList, function(item) {
    const found = _.find(BANNED, function(value) {
      if (value[0] === '*') {
        return item.search(value.substring(1)) !== -1;
      }
      return value === item;
    });
    if (found) {
      return item;
    }
  });
  let pending = fileList.length;

  _.forEach(fileList, function(file) {
    let fileDir = dir + '/' + file;
    let stat = fs.lstatSync(fileDir);
    if (stat && stat.isDirectory() && options.recursive) {
      loadDirectory(fs.readdirSync(fileDir), fileDir, options);
    } else {
      if (!_.isNull(file.match(options.re))) {
        let name = file.replace(options.type, '');
        options.results.push({
          directory: fileDir,
          name: name
        });
      }
    }
  });

  if (options.results.length >= pending) {
    let resultsMap = {};
    _.forEach(options.results, function(property) {
      if (options.require) {
        resultsMap[property.name] = require(property.directory);
      } else {
        resultsMap[property.name] = loadFile(property.directory);
      }
    });
    if (options.returnDict) return resultsMap;
  }
}

/**
 * prepareFunction prepares request for the directory loading.
 * @param  {string}     destinationDir  Relative path to the directory to load
 * @param  {object}     required        Options object
 * @param  {string}     required.type            File extension to load
 * @param  {string}     required.currentDir      __dirname
 * @param  {boolean}    required.recursive      Should it load recursively, or just flat
 * @param  {string}     required.event           Event to emit after loading's finished
 * @param  {boolean}    required.returnDict      Should loader return dict
 * @return {function}   Callbacks helper function, loadDirectory
 */
function prepareFunction(destinationDir, required) {
  if (!required.type) throw new Error('You didn\'t specify file type/extension!');
  if (!required.currentDir || !destinationDir) {
    throw new Error('You didn\'t specify directories in loadDirectory!');
  }
  if (_.isUndefined(required.returnDict)) required.returnDict = true;

  const re = new RegExp('.+' + [required.type], 'g');
  const dir = path.resolve(required.currentDir, destinationDir);
  const fileList = fs.readdirSync(dir);

  return loadDirectory(fileList, dir, {
    type: required.type,
    recursive: required.recursive,
    event: required.event,
    re: re,
    results: [],
    returnDict: required.returnDict,
    require: !_.isUndefined(required.require) ? required.require : true
  });
}
module.exports = prepareFunction;
