const grpc = require('grpc')
const _ = require('lodash')
const gi = require('grpc-inspect')
const create = require('grpc-create-metadata')

const createClient = require('./client')
const BaseRequest = require('./request')
const Response = require('./response')

module.exports = caller

/**
 * Create client isntance.
 * @param {String} host - The host to connect to
 * @param {String|Object} proto Path to the protocol buffer definition file or
 *                              Object specifying <code>root</code> directory and <code>file</code> to load or
 *                              the static client constructor object itself
 * @param {String} name - In case of proto path the name of the service as defined in the proto definition.
 * @param {Object} credentials - The credentials to use to connect. Defaults to `grpc.credentials.createInsecure()`
 * @param {Object} options - Options to be passed to the gRPC client constructor
 * @param {Object} options.retry - In addition to gRPC client constructor options, we accept a `retry` option.
 *                                 The retry option is identical to `async.retry` and is passed as is to it.
 *                                 This is used only for `UNARY` calls to add automatic retry capability.
 * @returns {Object}
 *
 * @example <caption>Create client dynamically</caption>
 * const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')
 * const client = caller('localhost:50051', PROTO_PATH, 'Greeter')
 *
 * const root = path.join(__dirname, 'protos');
 * const file = 'helloworld.proto'
 * const client = caller('localhost:50051', { root, file }, 'Greeter')
 *
 * @example <caption>Create a static client</caption>
 * const services = require('./static/helloworld_grpc_pb')
 * const client = caller('localhost:50051', services.GreeterClient)
 */
function caller (host, proto, name, credentials, options) {
  let Ctor
  if (_.isString(proto) || (_.isObject(proto) && proto.root && proto.file)) {
    const loaded = grpc.load(proto)
    const descriptor = gi(loaded)
    if (!descriptor) {
      throw new Error(`Error parsing protocol buffer`)
    }

    Ctor = descriptor.client(name)
    if (!Ctor) {
      throw new Error(`Service name ${name} not found in protocol buffer definition`)
    }
  } else if (_.isObject(proto)) {
    Ctor = proto
    options = credentials
    credentials = name
  }

  const client = new Ctor(host, credentials || grpc.credentials.createInsecure(), options)

  return wrap(client)
}

function wrap (client, options) {
  const GRPCCaller = createClient(Object.getPrototypeOf(client))

  class Request extends BaseRequest {}

  const instance = new GRPCCaller(client, options)

  instance.Request = Request
  instance.Request.prototype.client = instance

  instance.Response = Response

  return instance
}

/**
 * Utility helper function to create <code>Metadata</code> object from plain Javascript object.
 * See <code>grpc-create-metadata</code> module.
 */
caller.metadata = create

/**
 * Utility function that can be used to wrap an already constructed client instance.
 */
caller.wrap = wrap
