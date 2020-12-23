const Sandbox = require('../dist').default;
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');

const sandbox = new Sandbox();

const file = '/home/user/Desktop/v8/V8-sandbox/file4.txt';
// By providing a file name as second argument you enable breakpoints
const script = 'module.exports = function fread(file){fs.readFileSync(file)}';
const ext = {};
const v8 = new Sandbox({
  console: 'inherit',
  // pass our declared ext variable to the sandbox
  sandbox: { ext },
  require: {
    external: true,
    builtin: [ 'fs', 'path' ],
    root: './'
  }
});
try {
  const t1 = performance.now();
  v8.run(script);
  const t2 = performance.now();
  console.log(t2 - t1);
} catch (err) {
  console.error('Failed to execute script.', err);
}
