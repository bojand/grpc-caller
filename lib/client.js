const grpc = require('grpc')
const _ = require('lodash')
const create = require('grpc-create-metadata')
const pc = require('promisify-call')

const Response = require('./response')

class Client {
  constructor (protoClientCtor, options) {
    const clientProto = this.clientProto = protoClientCtor.prototype

    // original implementations of the client functions
    this.impl = {}
    _.forOwn(clientProto, (fn, name) => {
      if (typeof clientProto[name] === 'function') {
        if ((!fn.responseStream && !fn.requestStream) ||
          (fn.responseStream && !fn.requestStream) ||
          (!fn.responseStream && fn.requestStream) ||
          (fn.responseStream && fn.requestStream)) {
          this._impl[name] = {
            name,
            fn
          }
        }
      }
    })

    this.promisifyClient()
  }

  promisifyClient () {
    // promisify the client
    const clientProto = this.clientProto
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
  }

  hasMethod (name) {
    return _.has(this._impl, name)
  }

  exec (request, fn) {
    const p = new Promise((resolve, reject) => {
      const methodName = request.methodName
      if (!_.has(this._impl, methodName)) {
        reject(new Error(`Invalid method: ${methodName}`))
      }

      const { metadata, param, options, responseMetadata, responseStatus } = request

      const fn = this._impl[methodName].fn
      if (!fn.responseStream && !fn.requestStream) {
        const call = this.clientProto[methodName](param, metadata, options, (err, res) => {
          if (err) {
            return reject(err)
          }

          const response = new Response(call, res)

          if (!responseMetadata && !responseStatus) {
            return resolve(response)
          }

          call.on('metadata', md => {
            response.metadata = md
          })

          call.on('status', status => {
            response.status = status
            resolve(response)
          })
        })
      }
    })

    if (fn) {
      p.then(callResult => {
        fn(null, callResult)
      }).catch(fn)
    } else {
      return p
    }
  }
}

module.exports = Client
