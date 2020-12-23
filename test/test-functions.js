// these functions have access to node and are callable from the sandbox

const fs = require('fs');
const path = require('path');

const LARGE_VALUE = fs.readFileSync(path.join(__dirname, 'test.html')).toString();

// Example of a synchronous function
define('addNumbers', ([ value1, value2 ], { respond }) => {
  respond(value1 + value2);
});

// Example of a blocking function. It's a synchronous function for the sandbox, but asynchronous to the host
define('addNumbersBlocking', ([ value1, value2 ], { respond }) => {
  setTimeout(() => {
    respond(value1 + value2);
  }, 1);
});

// Example of an asynchronous function
defineAsync('addNumbersAsync', ([ value1, value2 ], { respond, callback }) => {
  setTimeout(() => {
    callback(null, value1 + value2);
  }, 20);

  respond();
});

defineAsync('errorAsync', ({ callback }) => {
  throw new Error('hi');
});

defineAsync('errorAsyncCallback', ([ param1 ], { fail, callback }) => {
  setTimeout(() => {
    fail(new Error('hi'));
  }, 1);
});

defineAsync('executeWithContext', ([ param1 ], { context, fail, respond }) => {
  setTimeout(() => {
    respond(context.customValue);
  }, 1);
});

defineAsync('fetchLargeValue', (args, { fail, respond }) => {
  setTimeout(() => {
    respond(LARGE_VALUE);
  }, 1);
});
