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

