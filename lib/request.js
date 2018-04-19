class Request {
  constructor (methodName, param) {
    if (!methodName) {
      throw new Error('Request method name required')
    }

    this.methodName = methodName
    this.param = param
    this.responseMetadata = false
    this.responseStatus = false
    this.retries = 0
  }

  withGrpcOptions (opts) {
    this.options = opts
    return this
  }

  withMetadata (metadata) {
    this.metadata = metadata
    return this
  }

  withRetries (retries) {
    this.retries = retries
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
    return this.client.exec(this, fn)
  }
}

module.exports = Request
