// TextEncoder/TextDecoder polyfill
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// ReadableStream polyfill
if (typeof global.ReadableStream === 'undefined') {
  try {
    // Try to use ReadableStream from undici if available
    const { ReadableStream } = require('undici');
    if (ReadableStream) {
      global.ReadableStream = ReadableStream;
    }
  } catch (e) {
    // Fallback: try stream/web (Node.js 18+)
    try {
      const { ReadableStream } = require('stream/web');
      global.ReadableStream = ReadableStream;
    } catch (e2) {
      // Final fallback: create a minimal ReadableStream polyfill
      global.ReadableStream = class ReadableStream {
        constructor(underlyingSource) {
          this._underlyingSource = underlyingSource;
          this._chunks = [];
          this._closed = false;
          this._error = null;
          this._started = false;
        }

        getReader() {
          if (!this._started && this._underlyingSource && this._underlyingSource.start) {
            this._started = true;
            const controller = {
              enqueue: (chunk) => {
                this._chunks.push(chunk);
              },
              close: () => {
                this._closed = true;
              },
              error: (error) => {
                this._error = error;
              }
            };
            try {
              this._underlyingSource.start(controller);
            } catch (error) {
              controller.error(error);
            }
          }
          return {
            read: async () => {
              if (this._error) {
                throw this._error;
              }
              if (this._closed && this._chunks.length === 0) {
                return { done: true, value: undefined };
              }
              if (this._chunks.length > 0) {
                return { done: false, value: this._chunks.shift() };
              }
              return { done: false, value: undefined };
            }
          };
        }
      };
    }
  }
}

if (typeof global.Request === 'undefined') {
  try {
    const { Request, Response, Headers } = require('undici')
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
    
    if (!Response.json) {
      Response.json = function(data, init) {
        return new Response(JSON.stringify(data), {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
          },
        })
      }
    }
  } catch (e) {
    try {
      const fetch = require('node-fetch')
      if (fetch.Request) {
        global.Request = fetch.Request
        global.Response = fetch.Response
        global.Headers = fetch.Headers
      } else {
        const { Request, Response, Headers } = fetch
        global.Request = Request
        global.Response = Response
        global.Headers = Headers
      }
      
      if (!Response.json) {
        Response.json = function(data, init) {
          return new Response(JSON.stringify(data), {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...init?.headers,
            },
          })
        }
      }
    } catch (e2) {
      console.warn('Could not load Request/Response polyfill')
    }
  }
}

