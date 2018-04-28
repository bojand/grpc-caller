/**
 * A Response class that encapsulates the response of a call using the `Request` API.
 */
class Response {
  constructor (call, response, metadata, status) {
    this.call = call
    this.response = response
    this.metadata = metadata
    this.status = status
  }
}

/**
 * The response's gRPC call.
 * @member {Object} call
 * @memberof Response#
 */

/**
 * The actual response data from the call.
 * @member {Object} response
 * @memberof Response#
 */

/**
 * The response metadata.
 * @member {Object} metadata
 * @memberof Response#
 */

/**
 * The response status metadata.
 * @member {Object} status
 * @memberof Response#
 */

module.exports = Response
