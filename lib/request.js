function createRequest (client) {
  class Request {
    constructor (methodName, param) {
      if (!methodName) {
        throw new Error('Request method name required')
      }

      if (!client.hasMethod(methodName)) {
        throw new Error(`Invalid method: ${methodName}`)
      }

      this.methodName = methodName
      this.param = param
    }

    setOptions (opts) {
      this.options = opts
      return this
    }

    setMetadata (metadata) {
      this.metadata = metadata
      return this
    }

    responseMetadata (value) {
      this.responseMetadata = value
      return this
    }

    responseStatus (value) {
      this.responseStatus = value
      return this
    }

    exec (fn) {
      client._exec(this, fn)
    }
  }

  return Request
}

module.exports = createRequest
