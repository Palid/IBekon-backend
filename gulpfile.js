"use strict";
var gulp = require('gulp');

var eslint = require('gulp-eslint');
var jest = require('gulp-jest-iojs');
var jsdoc = require("./jsdoc-runner");

var DIR = './lib/**/*.js';

var JEST_OPTIONS = {
  collectCoverage: true,
  testDirectoryName: "__tests__",
  moduleFileExtensions: [
    "js",
    "json",
    "react",
    "es6"
  ],
  "scriptPreprocessor": "<rootDir>/node_modules/babel-jest",
  "testFileExtensions": ["es6", "js"],
  "unmockedModulePathPatterns": [
    'lodash',
    'supermixer',
    'stampit',
    'bluebird'
  ]
};



gulp.task('docs', function () {
  jsdoc([
    '-r', 'lib/',
    '-d', 'docs/'
  ]);
});

gulp.task('lint', function () {
  return gulp.src(DIR)
    .pipe(eslint.format());
});

gulp.task('test', function () {
  return gulp.src('./lib/')
    .pipe(jest(JEST_OPTIONS));
});

gulp.task('watch', function () {
  gulp.watch(DIR, [
    'lint',
    'tests',
    'docs'
  ]);
});
// define tasks here
gulp.task('default', [
  'lint',
  'test',
  'docs',
  'watch'
]);
