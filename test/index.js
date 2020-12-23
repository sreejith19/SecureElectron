// import Sandbox from '../dist/server/sandbox';
import Sandbox from '../dist/cluster/cluster';
import SimpleSandbox from '../dist/server/sandbox';
import fs from 'fs';
import path from 'path';

import assert from 'assert';

const sandbox = new Sandbox();

const runWithTimeout = async (code, timeout) => {
  return sandbox.execute({ code, timeout });
};

const run = (code) => {
  return runWithTimeout(code, 4000);
};

const REQUIRE = path.join(__dirname, 'test-functions.js');

const TEST_URL = 'https://gist.githubusercontent.com/zhm/39714de5e103126561da5f60e0fe0ce2/raw/46c1114c9f78a75d67dc4100d7e5e4d63ea5c583/gistfile1.txt';

describe('sandbox', () => {
  after(() => {
    sandbox.shutdown();
  });

  // it('should execute simple script', async () => {
  //   const js = '1 + 2';

  //   const { value } = await run(js);

  //   assert.equal(value, 3);
  // });

  it('should execute simple script with setResult', async () => {
    const js = 'setResult({ value: "hi" })';

    const { value } = await run(js);

    assert.equal(value, 'hi');
  });

  it('should execute simple script with multiple setResult calls', async () => {
    const js = 'setResult({ value: "hi" }); setResult({ value: "hello" });';

    const { value } = await run(js);

    assert.equal(value, 'hi');
  });

  it('should execute simple httpRequest', async () => {
    const js = `
httpRequest({uri: '${TEST_URL}'}, (err, res, body) => {
  setResult({value: body});
});
`;

    const { value } = await run(js);

    assert.equal(value, 'hi there');
  });

  it('should execute simple synchronous httpRequest', async () => {
    const js = `
setResult({ value: httpRequest({uri: '${TEST_URL}'}).body });
`;

    const { value } = await run(js);

    assert.equal(value, 'hi there');
  });

  it('should handle errors from httpRequest', async () => {
    const js = `
httpRequest({uri: '${TEST_URL}'}, (err, res, body) => {
  throw new Error('yoyo');
});
`;

    const { error } = await run(js);

    assert.equal(error.message, 'yoyo');
  });

  it('should handle network errors from httpRequest', async () => {
    const js = `
httpRequest({uri: 'http://no-way-this-exists-12345.net'}, (error, res, body) => {
  setResult({ error });
});
`;

    const { error } = await run(js);

    assert.equal(error.code, 'ENOTFOUND');
  });

  it('should execute httpRequest within a timeout and async function', async () => {
    const js = `
setTimeout(() => {
  httpRequest({uri: '${TEST_URL}'}, (err, res, body) => {
    (async () => {
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1);
      });

      setResult({value: body});
    })();
  });
}, 1);

11;
`;

    const { value } = await run(js);

    assert.equal(value, 'hi there');
  });

  it('should handle promises', async () => {
    const js = `
new Promise((resolve) => {
  setTimeout(() => {
    setResult({value: 1});
    resolve();
  }, 20);
});
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should handle async functions', async () => {
    const js = `
(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 20);
  });

  setResult({value: 1});
})();
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should handle strings with null bytes', async () => {
    const string = 'test\u0000\u0000\u0000string';

    const js = `setResult({ value: ${ JSON.stringify(string) } })`;

    const { value } = await run(js);

    assert.equal(value, string);
  });

  it('should handle buffers', async () => {
    const js = 'setResult({ value: new SharedArrayBuffer(1024).byteLength })';

    const { value } = await run(js);

    assert.equal(value, 1024);
  });

  it('should handle async function with no setResult', async () => {
    const js = `
  (async () => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });
  })();
  `;

    const { error } = await runWithTimeout(js, 300);

    assert.equal(error.isTimeout, true);
  });

  it('should handle multiple async functions', async () => {
    const js = `
(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 20);
  });

  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 20);
  });

  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 20);
  });

  setResult({value: 1});
})();
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should handle multiple async functions nested within timeouts', async () => {
    const js = `
setTimeout(() => {
  (async () => {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 20);
    });

    setResult({value: 12});
  })();
}, 1);
`;

    const { value } = await run(js);

    assert.equal(value, 12);
  });

  it('should collect garbage', async () => {
    const js = `
let objects = []

for (let i = 0; i < 100000; ++i) {
  objects.push(JSON.stringify({test: 1, value: 'two'}));
}

objects = [];

setResult({value: 1});
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should handle syntax errors', async () => {
    const js = '}';

    const { error } = await run(js);

    assert.ok(error && error.stack.indexOf('SyntaxError') >= 0);
  });

  it('should capture logs', async () => {
    const js = 'console.log(\'hi\'); console.error(\'there\'); console.log(\'yo\'); setResult();';

    const { output } = await runWithTimeout(js, 30);

    assert.deepStrictEqual(output.map(o => o.message), [ 'hi', 'there', 'yo' ]);
  });

  it('should run simple script', async () => {
    const js = 'setResult({value: 1337});';

    const { value } = await run(js);

    assert.equal(value, 1337);
  });

  it('should execute setTimeout', async () => {
    const js = `
setTimeout(() => {
  setResult({value: 1});
}, 1);
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should execute setTimeout multiple times', async () => {
    const js = `
setTimeout(() => {
  setTimeout(() => {
    setTimeout(() => {
      setResult({value: 1});
    }, 1);
  }, 1);
}, 1);
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should execute setTimeout multiple times with clearTimeout', async () => {
    const js = `
let value = 1;

const id = setTimeout(() => {
  value = 2;
}, 1000);

clearTimeout(id);

setTimeout(() => {
  setResult({value});
}, 5);
`;

    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should clearTimeout multiple times', async () => {
    const js = `
let value = 1;

const id = setTimeout(() => {
  value = 2;
}, 1000);

clearTimeout(id);
clearTimeout(id);

setTimeout(() => {
  setResult({value});
}, 15);
`;
    const { value } = await run(js);

    assert.equal(value, 1);
  });

  it('should setTimeout with setResult', async () => {
    const js = `
let value = 1;

const id = setTimeout(() => {
  value = 2;
}, 10);

setTimeout(() => {
  setResult({value});
}, 15);
`;

    const { value } = await run(js);

    assert.equal(value, 2);
  });

  it('should timeout when locked up in js', async () => {
    const js = 'while (true) {}';

    const { error } = await runWithTimeout(js, 30);

    assert.equal(error.isTimeout, true);
  });

  it('should timeout when idling in the run loop', async () => {
    const js = 'setTimeout(() => {}, 10000)';

    const { error } = await runWithTimeout(js, 30);

    assert.equal(error.isTimeout, true);
  });

  it('should timeout many times', async () => {
    const js = 'while (true) {}';

    const count = 20;

    const operations = [];

    for (let i = count; i > 0; --i) {
      operations.push(runWithTimeout(js, 30));
    }

    const results = await Promise.all(operations);

    for (const { error } of results) {
      assert.equal(error.isTimeout, true);
    }

    assert.equal(results.length, 20);
  });

  it('should throw errors from top level script', async () => {
    const js = 'throw new Error(\'yoyo\')';

    const { error } = await run(js);

    assert.equal(error.message, 'yoyo');
  });

  it('should throw errors from setTimeout callbacks', async () => {
    const js = `
setTimeout(() => {
  throw new Error('yoyo');
}, 1);
`;

    const { error } = await run(js);

    assert.equal(error.message, 'yoyo');
  });

  it('should not crash when calling native functions with invalid arguments', async () => {
    const js = `
      function invoke(fn) {
        try {
          return fn();
        } catch (ex) {
          return ex.message;
        }
      }

      setResult({value: [
        invoke(() => _setTimeout()),
        invoke(() => _setTimeout(null)),
        invoke(() => _setTimeout(7, 7)),
        invoke(() => _clearTimeout()),
        invoke(() => _clearTimeout(null)),
        invoke(() => _dispatchSync()),
        invoke(() => _dispatchSync(null)),
        invoke(() => _dispatchSync('setResult', null)),
        invoke(() => _dispatchSync('test')),
        invoke(() => _dispatchSync(() => {}, () => {})),
        invoke(() => _dispatchSync(new Promise(() => {}))),
        invoke(() => _dispatchAsync()),
        invoke(() => _dispatchAsync(null)),
        invoke(() => _dispatchAsync('test')),
        invoke(() => _httpRequest(8)),
        invoke(() => _httpRequest('test', 7)),
        invoke(() => _log()),
        invoke(() => _error())
      ]});
`;

    const { value, error } = await run(js);

    assert.equal(value.length, 18);
  });

  it('should handle stress', async () => {
    const iterations = 500;

    const count = 0;
    const operations = [];

    for (let i = 0; i < iterations; ++i) {
      const js = `
setTimeout(() => {
  setResult({value: ${i}});
}, 1);
`;

      operations.push(run(js));
    }

    const results = await Promise.all(operations);

    for (let i = 0; i < results.length; ++i) {
      assert.equal(results[i].value, i);
    }
  });

  it('should handle queued stress', async () => {
    const iterations = 500;

    let count = 0;

    const operations = [];

    return new Promise((resolve) => {
      for (let i = 0; i < iterations; ++i) {
        const js = `
  setTimeout(() => {
    setResult({value: ${i}});
  }, 1);
  `;

        setImmediate(() => {
          run(js).then(({ error, value }) => {
            count++;

            assert.equal(value, i);

            if (count === iterations) {
              resolve();
            }
          });
        });
      }
    });
  });

  it('should handle recursive stress', (done) => {
    const iterations = 500;

    const executeNext = (i) => {
      const js = `
setResult({value: ${i}});
`;

      run(js).then(({ error, value }) => {
        assert.equal(value, i);

        if (i === iterations) {
          done();
        } else {
          setImmediate(() => {
            executeNext(i + 1);
          });
        }
      });
    };

    executeNext(0);
  });

  it('should handle template scripts', async () => {
    const template = `
global.testValue = 1;
`;

    const sandbox = new Sandbox({ template });

    const code = `
setTimeout(() => {
  setResult({value: ++global.testValue});
}, 1);
`;

    const { value } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(value, 2);

    sandbox.shutdown();
  });

  it('should handle syntax errors in template scripts', async () => {
    const template = '{';

    const sandbox = new Sandbox({ template });

    const code = 'setResult({value: 1});';

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(error.message, 'Unexpected end of input');

    sandbox.shutdown();
  });

  it('should handle errors when crossing between nodejs and sandbox', async () => {
    const template = '';

    const sandbox = new Sandbox({ template });

    // must use the raw _setTimeout which doesn't wrap in try/catch. Assume everything in the sandbox
    // can be overwritten or called manually. This test exercises the TryCatch in OnTimer from C++.

    const code = `
      const invocation = JSON.stringify({ name: 'setTimeout', args: [ 1 ] });
      const callback = () => { throw new Error('hi'); };

      _dispatch('setTimeout', invocation, callback);
    `;

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(error.message, 'Uncaught Error: hi');

    sandbox.shutdown();
  });

  it('should handle nasty parameter errors when crossing between nodejs and sandbox', async () => {
    const template = '';

    const sandbox = new Sandbox({ template });

    const code = '_dispatch(null)';

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(error.message, 'name must be a string');

    sandbox.shutdown();
  });

  it('should allow crossing between nodejs and sandbox with custom sync functions', async () => {
    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setTimeout(() => {
  setResult({value: addNumbers(1, 2)});
}, 1);
`;

    for (let count = 0; count < 20; ++count) {
      const res = await sandbox.execute({ code, timeout: 3000 });

      assert.equal(res.value, 3);
    }

    sandbox.shutdown();
  });

  it('should allow crossing between nodejs and sandbox with custom blocking functions', async () => {
    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setTimeout(() => {
  setResult({value: addNumbersBlocking(1, 2)});
}, 1);
`;

    for (let count = 0; count < 20; ++count) {
      const { value, error } = await sandbox.execute({ code, timeout: 3000 });

      assert.equal(value, 3);
    }

    sandbox.shutdown();
  });

  it('should allow random crossing between nodejs and sandbox with custom sync functions', async function() {
    this.timeout(10000);

    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
const randomTimeout = () => Math.floor(Math.random() * 5) + 1;

for (let i = 0; i < 5000; ++i) {
  setTimeout(() => {
    setResult({value: addNumbers(1, 2)});
  }, randomTimeout());
}
`;

    const { value } = await sandbox.execute({ code, timeout: 10000 });

    assert.equal(value, 3);

    sandbox.shutdown();
  });

  it('should allow crossing between nodejs and sandbox with custom async functions', async function() {
    this.timeout(6000);

    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setTimeout(() => {
  addNumbersAsync(1, 2, (err, value) => {
    setResult({value});
  });
}, 1);
`;

    for (let count = 0; count < 20; ++count) {
      const { value } = await sandbox.execute({ code, timeout: 3000 });

      assert.equal(value, 3);
    }

    sandbox.shutdown();
  });

  it('should handle errors when crossing between nodejs and sandbox with custom functions', async () => {
    const template = '';

    const sandbox = new Sandbox({ template, require: REQUIRE });

    // hack the _try method to directly invoke the function. This would only be possible if someone stomped
    // on the global functions inside the sandbox. We have to assume everything can be stomped on. This
    // test exercises the TryCatch on the OnEndNodeInvocation from C++
    const code = `
global._try = (fn) => fn();

setTimeout(() => {
  addNumbersAsync(1, 2, (err, value) => {
    throw new Error('uh oh: ' + value);
  });
}, 20);
`;

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(error.message, 'Uncaught Error: uh oh: 3');

    sandbox.shutdown();
  });

  it('should handle errors throw from custom nodejs functions', async () => {
    const template = '';

    const sandbox = new Sandbox({ template, require: REQUIRE });

    // hack the _try method to directly invoke the function. This would only be possible if someone stomped
    // on the global functions inside the sandbox. We have to assume everything can be stomped on. This
    // test exercises the TryCatch on the OnEndNodeInvocation from C++
    const code = `
errorAsync(1, 2);
`;

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(error.message, 'hi');

    sandbox.shutdown();
  });

  it('should support global variable for custom nodejs functions', async () => {
    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setResult({ value: executeWithContext() });
`;

    const context = {
      customValue: 'hi'
    };

    const { value } = await sandbox.execute({ code, context, timeout: 3000 });

    assert.equal(value, 'hi');

    sandbox.shutdown();
  });

  it('should support global variable in the sandbox', async () => {
    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setResult({ value: customValue });
`;

    const globals = {
      customValue: 'hi'
    };

    const { value } = await sandbox.execute({ code, globals, timeout: 3000 });

    assert.equal(value, 'hi');

    sandbox.shutdown();
  });

  it('should support large payloads', async function() {
    this.timeout(6000);

    const sandbox = new Sandbox({ require: REQUIRE });

    const code = `
setResult({ value: fetchLargeValue() });
`;

    const { value } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(value.length, 3488889);

    sandbox.shutdown();
  });

  it('should support multiple initialization and not keep data around across execute calls', async () => {
    const sandbox = new SimpleSandbox({ require: REQUIRE });

    const code = 'global.currentValue = 1; setResult({ value: global.currentValue });';

    await sandbox.initialize({ timeout: 3000 });
    await sandbox.initialize({ timeout: 3000 });
    const { value } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(value, 1);

    const result = await sandbox.execute({ code: 'setResult({ value: global.currentValue });', timeout: 3000 });

    assert.equal(result.value, null);

    sandbox.shutdown();
  });

  it('should support shutdown and restart', async () => {
    const sandbox = new SimpleSandbox({ require: REQUIRE });

    const code = 'setResult({ value: 1 });';

    const { value } = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(value, 1);

    sandbox.shutdown();

    const result = await sandbox.execute({ code: 'setResult({ value: 1 });', timeout: 3000 });

    assert.equal(result.value, 1);

    sandbox.shutdown();
  });

  it('should support disabling networking and timers', async function() {
    this.timeout(10000);

    const sandbox = new SimpleSandbox({ require: REQUIRE, httpEnabled: false, timersEnabled: false });

    let code = 'setTimeout(() => {}, 1);';

    let result = await sandbox.execute({ code, timeout: 8000 });

    assert.equal(result.error.message, 'setTimeout is disabled');

    code = 'httpRequest({ url: "http://example.com" });';

    result = await sandbox.execute({ code, timeout: 3000 });

    assert.equal(result.error.message, 'httpRequest is disabled');

    sandbox.shutdown();
  });

  it('should handle hard memory crash in the sandbox', async function() {
    this.timeout(4000);

    const sandbox = new SimpleSandbox({ require: REQUIRE, memory: 32 });

    const code = `
    const value = 'here is a string value';
    const values = [];
    while (true) {
      values.push(value);
    }
    `;

    const { error } = await sandbox.execute({ code, timeout: 3000 });

    console.log('=============================================================');
    console.log(' ☝️  This crash is supposed to happen. It\'s part of the test.');
    console.log('=============================================================');

    assert.equal(error.message, 'worker exited');

    const { value } = await sandbox.execute({ code: 'setResult({ value: 1 });', timeout: 3000 });

    assert.equal(value, 1);

    sandbox.shutdown();
  });

  it('should handle custom flags', async () => {
    const sandbox = new SimpleSandbox({ require: REQUIRE, argv: [ '--harmony' ], debug: true });

    const code = 'setResult({ value: info() });';

    const { value } = await sandbox.execute({ code, timeout: 3000 });

    assert.deepStrictEqual(value.argv, [ '--harmony' ]);

    sandbox.shutdown();
  });
});
