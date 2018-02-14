class Response {
  constructor (call, response, metadata, status) {
    this.call = call
    this.response = response
    this.metadata = metadata
    this.status = status
  }
}

module.exports = Response
