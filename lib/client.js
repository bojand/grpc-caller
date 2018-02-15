const grpc = require('grpc')
const _ = require('lodash')
const create = require('grpc-create-metadata')
const pc = require('promisify-call')
const maybe = require('call-me-maybe')

const Response = require('./response')

function promisifyClientProto (clientProto, options) {
  // promisify the client
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

function expandClientProto (clientProto) {
  clientProto.hasMethod = function hasMethod (name) {
    return _.has(this._impl, name)
  }

  clientProto.exec = function exec (request, fn) {
    return maybe(fn, new Promise((resolve, reject) => {
      const methodName = request.methodName
      if (!_.has(this._impl, methodName)) {
        reject(new Error(`Invalid method: ${methodName}`))
      }

      const { metadata, param, options, responseMetadata, responseStatus } = request

      const implFn = this._impl[methodName].fn
      if (!implFn.responseStream && !implFn.requestStream) {
        const response = new Response()
        const call = this[methodName](param, metadata, options, (err, res) => {
          response.response = res
          if (err) {
            return reject(err)
          }

          return resolve(response)
        })

        response.call = call

        if (responseMetadata) {
          call.on('metadata', md => {
            response.metadata = md
          })
        }

        if (responseStatus) {
          call.on('status', status => {
            response.status = status
          })
        }
      }
    }))
  }

  clientProto.request = function request (methodName, param) {
    return new this.Request(methodName, param)
  }
}

function createClient (protoClientCtor, options) {
  const clientProto = protoClientCtor.prototype

  clientProto._impl = {}
  _.forOwn(clientProto, (fn, name) => {
    if (typeof clientProto[name] === 'function') {
      if ((!fn.responseStream && !fn.requestStream) ||
        (fn.responseStream && !fn.requestStream) ||
        (!fn.responseStream && fn.requestStream) ||
        (fn.responseStream && fn.requestStream)) {
        clientProto._impl[name] = {
          name,
          fn
        }
      }
    }
  })

  promisifyClientProto(clientProto, options)
  expandClientProto(clientProto)
}

module.exports = createClient
