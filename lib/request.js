const _ = require('lodash')

function createRequest (client) {
  const proto = Object.getPrototypeOf(client)
  const protoFns = Object.getOwnPropertyNames(proto)
  const fns = _.difference(protoFns, ['constructor', '_exec'])

  class Request {
    constructor (methodName, param) {
      if (!methodName) {
        throw new Error('Request method name required')
      }

      if (fns.indexOf(methodName) < 0) {
        throw new Error(`Invalid method: ${methodName}`)
      }

      this.methodName = methodName
      this.param = param
      this.responseMetadata = false
      this.responseStatus = false
    }

    setOptions (opts) {
      this.options = opts
      return this
    }

    setMetadata (metadata) {
      this.metadata = metadata
      return this
    }

    withResponseMetadata (value) {
      this.responseMetadata = value
      return this
    }

    withResponseStatus (value) {
      this.responseStatus = value
      return this
    }

    exec (fn) {
      return client._exec(this, fn)
    }
  }

  return Request
}

module.exports = createRequest
