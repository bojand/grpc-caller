/**
 * A Request class that encapsulates the request of a call.
 */
class Request {
  /**
   * Creates a Request instance.
   * @param {String} methodName the method name.
   * @param {*} param the call argument in case of `UNARY` calls.
   */
  constructor (methodName, param) {
    if (!methodName) {
      throw new Error('Request method name required')
    }

    this.methodName = methodName
    this.param = param
    this.responseMetadata = false
    this.responseStatus = false
    this.retry = null
  }

  /**
   * Create a request with call options.
   * @param {Object} opts The gRPC call options.
   * @return {Object} the request instance.
   */
  withGrpcOptions (opts) {
    this.options = opts
    return this
  }

  /**
   * Create a request with call metadata.
   * @param {Object} opts The gRPC call metadata.
   *                      Can either be a plain object or an instance of `grpc.Metadata`.
   * @return {Object} the request instance.
   */
  withMetadata (metadata) {
    this.metadata = metadata
    return this
  }

  /**
   * Create a request with retry options.
   * @param {Number | Object} retry The retry options. Identical to `async.retry`.
   * @return {Object} the request instance.
   */
  withRetry (retry) {
    this.retry = retry
    return this
  }

  /**
   * Create a request indicating whether we want to collect the response metadata.
   * @param {Boolean} value `true` to collect the response metadata. Default `false`.
   * @return {Object} the request instance.
   */
  withResponseMetadata (value) {
    this.responseMetadata = value
    return this
  }

  /**
   * Create a request indicating whether we want to collect the response status metadata.
   * @param {Boolean} value `true` to collect the response status metadata. Default `false`.
   * @return {Object} the request instance.
   */
  withResponseStatus (value) {
    this.responseStatus = value
    return this
  }

  /**
   * Execute the request.
   * @param {Function} fn Optional callback
   * @return {Promise|Object} If no callback is provided in case of `UNARY` call a Promise is returned.
   *                          If no callback is provided in case of `REQUEST_STREAMING` call an object is
   *                          returned with `call` property being the call stream and `res`
   *                          property being a Promise fulfilled when the call is completed.
   */
  exec (fn) {
    return this.client.exec(this, fn)
  }
}

module.exports = Request
