function createRequest (client) {
  class Request {
    constructor (methodName, param) {
      if (!methodName) {
        throw new Error('Request method name required')
      }

      if (!client._hasMethod(methodName)) {
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
