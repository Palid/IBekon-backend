"use strict";
var gulp = require('gulp');

var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var flowtype = require('gulp-flowtype');
var jest = require('gulp-jest');
var nodemon = require('gulp-nodemon');
var jsdoc = require("./jsdoc-runner");

var DIR = './lib/**/*.js';

var JEST_OPTIONS = {
  scriptPreprocessor: "./spec/support/preprocessor.js",
  unmockedModulePathPatterns: [
    "node_modules/react"
  ],
  testDirectoryName: "__tests__",
  testPathIgnorePatterns: [
    "node_modules",
    "spec/support"
  ],
  moduleFileExtensions: [
    "js",
    "json",
    "react"
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
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('typecheck', function () {
  return gulp.src(DIR)
    .pipe(flowtype());
});

gulp.task('tests', function () {
  return gulp.src('./lib/')
    .pipe(jest());
});

gulp.task('watch', function () {
  gulp.watch(DIR, [
    // 'typecheck',
    'lint',
    'tests',
    'docs'
  ]);
});
// define tasks here
gulp.task('default', [
  // 'typecheck',
  'lint',
  'tests',
  'docs',
  'watch'
]);
