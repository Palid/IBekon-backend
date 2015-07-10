"use strict";
var gulp = require('gulp');

var jshint = require('gulp-jshint');
// var flowtype = require('gulp-flowtype');
var jestRunner = require('gulp-jest-iojs');
var jsdoc = require("./jsdoc-runner");

var DIR = './lib/**/*.js';

var JEST_OPTIONS = {
  collectCoverage: true,
  testDirectoryName: "__tests__",
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

gulp.task('test', function () {
  return gulp.src('./lib/')
    .pipe(jestRunner(JEST_OPTIONS));
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
  'test',
  'docs',
  'watch'
]);
