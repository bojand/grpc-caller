const grpc = require('grpc')
const _ = require('lodash')
const gi = require('grpc-inspect')
const pc = require('promisify-call')
const create = require('grpc-create-metadata')

module.exports = caller

/**
 * Create client isntance.
 * @param {String} host - The host to connect to
 * @param {String|Object} proto Path to the protocol buffer definition file or
 *                              Object specifying <code>root</code> directory and <code>file</code> to load or
 *                              the static client constructor object itself
 * @param {String} name - In case of proto path the name of the service as defined in the proto definition.
 * @param {Object} options - Options to be passed to the gRPC client constructor
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
function caller (host, proto, name, options) {
  let Ctor
  if (_.isString(proto)  || (_.isObject(proto) && proto.root && proto.file)) {
    const loaded = grpc.load(proto)
    const descriptor = gi(loaded)
    if (!descriptor) {
      throw new Error(String.raw `Error parsing protocol buffer`)
    }

    Ctor = descriptor.client(name)
    if (!Ctor) {
      throw new Error(String.raw `Service name ${name} not found in protocol buffer definition`)
    }
  } else if (_.isObject(proto)) {
    Ctor = proto
    options = name
  }

  // promisify the client
  const clientProto = Ctor.prototype
  _.forOwn(clientProto, (v, k) => {
    if (typeof clientProto[k] === 'function') {
      if (!v.responseStream && !v.requestStream) {
        clientProto[k] = function (arg, metadata, options, fn) {
          if (_.isFunction(options)) {
            fn = options
            options = undefined
          }
          if (_.isFunction(metadata)) {
            fn = metadata
            metadata = undefined
          }
          if (_.isPlainObject(metadata) && metadata instanceof grpc.Metadata === false) {
            metadata = create(metadata)
          }
          const args = _.compact([arg, metadata, options, fn])
            // only promisify-call functions in simple response / request scenario
          return pc(this, v, ...args)
        }
      } else if (v.responseStream && !v.requestStream) {
        clientProto[k] = function (arg, metadata, options) {
          if (_.isPlainObject(metadata) && metadata instanceof grpc.Metadata === false) {
            metadata = create(metadata)
          }
          const args = _.compact([arg, metadata, options])
          return v.call(this, ...args)
        }
      } else if (!v.responseStream && v.requestStream) {
        clientProto[k] = function (metadata, options, fn) {
          if (_.isFunction(options)) {
            fn = options
            options = undefined
          }
          if (_.isFunction(metadata)) {
            fn = metadata
            metadata = undefined
          }
          if (_.isPlainObject(metadata) && metadata instanceof grpc.Metadata === false) {
            metadata = create(metadata)
          }
          if (fn) { // normal call
            const args = _.compact([metadata, options, fn])
            return v.call(this, ...args)
          } else { // dual return promsified call with return { call, res }
            const r = {}
            const p = new Promise((resolve, reject) => {
              const args = _.compact([metadata, options, fn])
              args.push((err, result) => {
                if (err) reject(err)
                else resolve(result)
              })
              r.call = v.call(this, ...args)
            })
            r.res = p
            return r
          }
        }
      } else if (v.responseStream && v.requestStream) {
        clientProto[k] = function (metadata, options) {
          if (_.isPlainObject(metadata) && metadata instanceof grpc.Metadata === false) {
            metadata = create(metadata)
          }
          const args = _.compact([metadata, options])
          return v.call(this, ...args)
        }
      }
    }
  })

  return new Ctor(host, options || grpc.credentials.createInsecure())
}

/**
 * Utility helper function to create <code>Metadata</code> object from plain Javascript object.
 * See <code>grpc-create-metadata</code> module.
 */
caller.metadata = create
