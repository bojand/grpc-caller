const grpc = require('@grpc/grpc-js')
const _ = require('lodash')
const async = require('async')
const create = require('grpc-create-metadata')
const pc = require('promisify-call')
const maybe = require('call-me-maybe')

const Response = require('./response')

function createClient (clientProto) {
  class GRPCCaller {
    constructor (client, metadata = {}, options = {}) {
      this.client = client
      this.defaults = { metadata, options }
    }

    createOptions (options) {
      return _.merge({}, this.defaults.options, options)
    }

    createMetadata (metadata) {
      if (metadata && isGRPCMetadata(metadata)) {
        const metadataClone = metadata.clone()
        Object.keys(this.defaults.metadata)
          .forEach(key => {
            if (metadataClone.get(key).length === 0) {
              metadataClone.set(key, this.defaults.metadata[key])
            }
          })

        return metadataClone
      }
      return create(_.merge({}, this.defaults.metadata, metadata))
    }
  }

  promisifyClientProto(GRPCCaller.prototype, clientProto)
  createExec(GRPCCaller.prototype)

  return GRPCCaller
}

function promisifyClientProto (targetProto, clientProto) {
  // promisify the client
  _.forOwn(clientProto, (v, k) => {
    if (k === 'constructor') {
      return
    }

    if (typeof clientProto[k] === 'function') {
      if (!v.requestStream && !v.responseStream) {
        targetProto[k] = function (arg, metadata, options, fn) {
          if (_.isFunction(options)) {
            fn = options
            options = null
          }

          if (_.isFunction(metadata)) {
            fn = metadata
            metadata = null
            options = null
          }

          options = this.createOptions(options)
          metadata = this.createMetadata(metadata)

          if (_.has(options, 'retry')) {
            const retryOpts = options.retry
            const callOpts = options ? _.omit(options, 'retry') : options

            if (_.isFunction(fn)) {
              async.retry(retryOpts, rCb => {
                v.call(this.client, arg, metadata, callOpts, rCb)
              }, fn)
            } else {
              return new Promise((resolve, reject) => {
                async.retry(retryOpts, rCb => {
                  v.call(this.client, arg, metadata, callOpts, rCb)
                }, (err, res) => {
                  if (err) reject(err)
                  else resolve(res)
                })
              })
            }
          } else {
            const args = _.compact([arg, metadata, options, fn])

            return pc(this.client, v, ...args)
          }
        }
      } else if (!v.requestStream && v.responseStream) {
        targetProto[k] = function (arg, metadata, options) {
          options = this.createOptions(options)
          metadata = this.createMetadata(metadata)

          const args = _.compact([arg, metadata, options])
          return v.call(this.client, ...args)
        }
      } else if (v.requestStream && !v.responseStream) {
        targetProto[k] = function (metadata, options, fn) {
          if (_.isFunction(options)) {
            fn = options
            options = undefined
          }
          if (_.isFunction(metadata)) {
            fn = metadata
            metadata = undefined
          }

          options = this.createOptions(options)
          metadata = this.createMetadata(metadata)

          if (fn) { // normal call
            const args = _.compact([metadata, options, fn])
            return v.call(this.client, ...args)
          } else { // dual return promsified call with return { call, res }
            const r = {}
            const p = new Promise((resolve, reject) => {
              const args = _.compact([metadata, options, fn])
              args.push((err, result) => {
                if (err) reject(err)
                else resolve(result)
              })
              r.call = v.call(this.client, ...args)
            })
            r.res = p
            return r
          }
        }
      } else if (v.requestStream && v.responseStream) {
        targetProto[k] = function (metadata, options) {
          options = this.createOptions(options)
          metadata = this.createMetadata(metadata)

          const args = _.compact([metadata, options])
          return v.call(this.client, ...args)
        }
      }
    }
  })
}

function createExec (clientProto) {
  clientProto.exec = function exec (request, fn) {
    const methodName = request.methodName

    if (!_.isFunction(this.client[methodName])) {
      throw new Error(`Invalid method: ${methodName}`)
    }

    const implFn = this.client[methodName]

    if ((implFn.responseStream && !implFn.requestStream) ||
      (implFn.responseStream && implFn.requestStream)) {
      throw new Error(`Invalid call: ${methodName} cannot be called using Request API`)
    }

    const {
      param,
      retry,
      responseMetadata,
      responseStatus
    } = request

    const options = this.createOptions(request.options)
    const metadata = this.createMetadata(request.metadata)

    if (!implFn.responseStream && !implFn.requestStream) {
      return maybe(fn, new Promise((resolve, reject) => {
        const response = new Response()
        let r = 0
        if (retry) {
          r = retry
        }

        async.retry(r, rCb => {
          const call = this[methodName](param, metadata, options, rCb)

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
        }, (err, res) => {
          response.response = res
          if (err) {
            return reject(err)
          }

          return resolve(response)
        })
      }))
    } else if (implFn.requestStream && !implFn.responseStream) {
      const r = {}
      const response = new Response()

      const { call, res } = this[methodName](metadata, options)
      r.call = call

      r.call = call
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

      r.res = new Promise((resolve, reject) => {
        res.then(result => {
          response.response = result
          resolve(response)
        }).catch(e => reject(e))
      })

      if (fn) {
        r.res.then(result => {
          fn(null, result)
        }).catch(fn)
      }

      return fn ? call : r
    } else {
      throw new Error(`Invalid call: ${methodName} cannot be called using Request API`)
    }
  }
}

function isGRPCMetadata (obj) {
  if (obj instanceof grpc.Metadata) {
    return true
  }
  const proto = Object.getPrototypeOf(obj)
  if (_.isFunction(proto.getMap)) {
    return true
  }
  return false
}

module.exports = createClient
