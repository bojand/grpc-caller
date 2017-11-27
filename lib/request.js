class Request {
  constructor (methodName, param) {
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
    this._caller._exec(this, fn)
  }
}

module.exports = Request
