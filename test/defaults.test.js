const async = require('async')
const grpc = require('@grpc/grpc-js')
const path = require('path')
const test = require('ava')

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')

const apps = []

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const TEST_HOST = getHost()

test.before('start test servic', async (t) => {
  const messages = require('./static/helloworld_pb')
  const services = require('./static/helloworld_grpc_pb')

  function sayHello (call, callback) {
    const reply = new messages.HelloReply()
    let responceMessage = ''

    if (call.metadata.get('foo').length > 0) { responceMessage = `${call.metadata.get('foo')} -> ${responceMessage}` }

    responceMessage = `${responceMessage}Hello ${call.request.getName()}`

    if (call.metadata.get('ping').length > 0) { responceMessage = `${responceMessage} -> ${call.metadata.get('ping')}` }

    reply.setMessage(responceMessage)
    callback(null, reply)
  }

  const server = new grpc.Server()
  server.addService(services.GreeterService, { sayHello: sayHello })
  await new Promise((resolve, reject) => {
    server.bindAsync(TEST_HOST, grpc.ServerCredentials.createInsecure(),
      (err, result) => (err ? reject(err) : resolve(result))
    )
  })
  server.start()
  apps.push(server)
})

test.cb('should pass default metadata', t => {
  t.plan(4)
  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { metadata: { foo: 'bar' } })
  client.sayHello({ name: 'Bob' }, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar -> Hello Bob')
    t.end()
  })
})

test.cb('should pass extend metadata (simple object)', t => {
  t.plan(4)
  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { metadata: { foo: 'bar', ping: 'pong' } })
  client.sayHello({ name: 'Bob' }, { foo: 'bar2000' }, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar2000 -> Hello Bob -> pong')
    t.end()
  })
})

test.cb('should pass extend metadata (grpc.Metadata)', t => {
  t.plan(4)
  const meta = new grpc.Metadata()
  meta.add('ping', 'master')

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { metadata: { foo: 'bar' } })
  client.sayHello({ name: 'Bob' }, meta, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar -> Hello Bob -> master')
    t.end()
  })
})

test.cb('load interceptors and default metadata', t => {
  t.plan(5)

  const interceptor = (options, nextCall) =>
    new grpc.InterceptingCall(nextCall(options), {
      sendMessage: (message, next) => {
        t.is(message.name, 'Bob')
        next({ name: message.name + 2 })
      }
    })

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, {
    metadata: { foo: 'bar' },
    options: { interceptors: [interceptor] }
  })

  client.sayHello({ name: 'Bob' }, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar -> Hello Bob2')
    t.end()
  })
})

test.cb('load interceptors, default metadata and call metadata', t => {
  t.plan(5)

  const interceptor = (options, nextCall) =>
    new grpc.InterceptingCall(nextCall(options), {
      sendMessage: (message, next) => {
        t.is(message.name, 'Bob')
        next({ name: message.name + 2 })
      }
    })

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, {
    metadata: { foo: 'bar' },
    options: { interceptors: [interceptor] }
  })

  client.sayHello({ name: 'Bob' }, { ping: 'meta' }, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar -> Hello Bob2 -> meta')
    t.end()
  })
})

test('async options interceptors, default metadata and call metadata', async t => {
  t.plan(4)

  const interceptor = (options, nextCall) =>
    new grpc.InterceptingCall(nextCall(options), {
      sendMessage: (message, next) => {
        t.is(message.name, 'Bob')
        next({ name: message.name + 2 })
      }
    })

  const credentials = grpc.credentials.createInsecure()
  const options = {
    interceptors: [interceptor]
  }

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', credentials, options, {
    metadata: { foo: 'bar' }
  })

  const response = await client.sayHello({ name: 'Bob' }, { ping: 'meta' })
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'bar -> Hello Bob2 -> meta')
})

test('static async options interceptors, default metadata and call metadata', async t => {
  t.plan(4)

  const messages = require('./static/helloworld_pb')
  const services = require('./static/helloworld_grpc_pb')

  const interceptor = (options, nextCall) =>
    new grpc.InterceptingCall(nextCall(options), {
      sendMessage: (message, next) => {
        const name = message.getName()
        t.is(name, 'Bob')
        message.setName(name + 2)
        next(message)
      }
    })

  const credentials = grpc.credentials.createInsecure()
  const options = {
    interceptors: [interceptor]
  }

  const serviceClient = new services.GreeterClient(TEST_HOST, credentials, options)

  const client = caller.wrap(serviceClient, { foo: 'bar' }, options)

  const request = new messages.HelloRequest()
  request.setName('Bob')

  const response = await client.sayHello(request, { ping: 'meta' })
  t.truthy(response)
  t.truthy(response.getMessage())

  const msg = response.getMessage()
  t.is(msg, 'bar -> Hello Bob2 -> meta')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
