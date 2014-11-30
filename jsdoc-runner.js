"use strict";

var path = require('path');

/*
  Options:
    -t, --template <value>       The path to the template to use. Default: path/to/jsdoc/templates/default
    -c, --configure <value>      The path to the configuration file. Default: path/to/jsdoc/conf.json
    -e, --encoding <value>       Assume this encoding when reading all source files. Default: utf8
    -T, --test                   Run all tests and quit.
    -d, --destination <value>    The path to the output folder. Use "console" to dump data to the console. Default: ./out/
    -p, --private                Display symbols marked with the @private tag. Default: false
    -r, --recurse                Recurse into subdirectories when scanning for source code files.
    -h, --help                   Print this message and quit.
    -X, --explain                Dump all found doclet internals to console and quit.
    -q, --query <value>          A query string to parse and store in env.opts.query. Example: foo=bar&baz=true
    -u, --tutorials <value>      Directory in which JSDoc should search for tutorials.
    -P, --package <value>        The path to the project's package file. Default: path/to/sourcefiles/package.json
    -R, --readme <value>         The path to the project's README file. Default: path/to/sourcefiles/README.md
    -v, --version                Display the version number and quit.
    --debug                      Log information for debugging JSDoc. On Rhino, launches the debugger when passed as the first option.
    --verbose                    Log detailed information to the console as JSDoc runs.
    --pedantic                   Treat errors as fatal errors, and treat warnings as errors. Default: false
    --match <value>              Only run tests containing <value>.
    --nocolor                    Do not use color in console output from tests.
 */
function createDocs(cliOptions) {
  var spawn = require('child_process').spawn,
    child = spawn('./node_modules/.bin/jsdoc', cliOptions, {
      cwd: __dirname,
      env: process.env
    });

  child.stdin.setEncoding('utf8');
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  // var child = exec.buildSpawned(jsDoc, './lib/', {
  //   r: true
  // });
  child.stdout.on('data', function (data) {
    console.log(data);
  });
  child.stderr.on('data', function (data) {
    console.log(data);
  });
  child.on('exit', function (code) {
    console.log(code);
    // if (code === 0) {} else {}
  });

}


module.exports = createDocs;

createDocs([
    '-r', 'lib/',
    '-d', 'docs/'
  ]);
