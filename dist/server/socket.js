"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function tryParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch (ex) {
    return null;
  }
}

class Socket {
  constructor(socket, sandbox) {
    _defineProperty(this, "sandbox", void 0);

    _defineProperty(this, "worker", void 0);

    _defineProperty(this, "socket", void 0);

    _defineProperty(this, "closed", void 0);

    _defineProperty(this, "message", void 0);

    _defineProperty(this, "handleData", data => {
      if (!this.message) {
        this.message = {
          id: data.readInt32BE(0),
          length: data.readInt32BE(4),
          json: data.toString('utf8', 8)
        };
      } else {
        this.message.json += data.toString('utf8');
      }

      if (Buffer.byteLength(this.message.json) === this.message.length) {
        const {
          id,
          json
        } = this.message;
        this.message = null;
        const message = tryParseJSON(json);

        const callback = id > 0 && ((...args) => {
          if (this.isConnected) {
            this.sandbox.callback(id, args);
          }
        });

        const write = result => {
          const string = JSON.stringify({
            id,
            result: result || {
              value: undefined
            }
          });
          const length = Buffer.byteLength(string, 'utf8');
          const buffer = Buffer.alloc(length + 4);
          buffer.writeInt32BE(length);
          buffer.write(string, 4);

          if (this.isConnected) {
            this.socket.write(buffer);
          }
        };

        const respond = value => {
          write({
            value
          });
        };

        const fail = error => {
          write({
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          });
        };

        try {
          if (message == null) {
            throw new Error('invalid dispatch');
          }

          this.sandbox.dispatch(message, {
            fail,
            respond,
            callback
          });
        } catch (ex) {
          fail(ex);
        }
      }
    });

    _defineProperty(this, "handleError", error => {
      console.error('socket error', error);
    });

    _defineProperty(this, "handleDrain", () => {
      this.socket.resume();
    });

    _defineProperty(this, "handleClose", () => {
      this.closed = true;
    });

    _defineProperty(this, "handleEnd", () => {
      this.closed = true;
    });

    this.sandbox = sandbox;
    this.worker = sandbox.worker;
    this.socket = socket;
    this.socket.on('data', this.handleData);
    this.socket.on('end', this.handleEnd);
    this.socket.on('close', this.handleClose);
    this.socket.on('error', this.handleError);
    this.socket.on('drain', this.handleDrain);
  }

  shutdown() {
    if (this.socket) {
      this.closed = true;
      this.socket.end();
      this.socket.unref();
    }
  }

  get isConnected() {
    // make sure the current sandbox worker is the worker we started with. The worker might've
    // been replaced by the time this is invoked.
    return !this.closed && this.worker === this.sandbox.worker;
  }

}

exports.default = Socket;
//# sourceMappingURL=socket.js.map