import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc';

import caller from '../';

const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')

const apps = []

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const TEST_HOST = getHost()

test.before('start test servic', t => {
  const messages = require('./static/helloworld_pb')
  const services = require('./static/helloworld_grpc_pb')

  function sayHello (call, callback) {
    var reply = new messages.HelloReply()
    var responceMessage = '';

    if (call.metadata.get('foo').length > 0)
      responceMessage = `${call.metadata.get('foo')} -> ${responceMessage}`;

    responceMessage = `${responceMessage}Hello ${call.request.getName()}`;

    if (call.metadata.get('ping').length > 0)
      responceMessage = `${responceMessage} -> ${call.metadata.get('ping')}`;

    reply.setMessage(responceMessage)
    callback(null, reply)
  }

  var server = new grpc.Server()
  server.addService(services.GreeterService, { sayHello: sayHello })
  server.bind(TEST_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test.cb('should pass default metadata', t => {
  t.plan(4)
  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { metadata: { foo: 'bar' } })
  client.sayHello({ name: 'Bob' }, (err, response) => {
    t.ifError(err)
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
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar2000 -> Hello Bob -> pong')
    t.end()
  })
})

test.cb('should pass extend metadata (grpc.Metadata)', t => {
  t.plan(4)
  const meta = new grpc.Metadata()
  meta.add('ping', 'master');

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { metadata: { foo: 'bar' } })
  client.sayHello({ name: 'Bob' }, meta, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'bar -> Hello Bob -> master')
    t.end()
  })
})

test.cb('load interceptors', t => {
  t.plan(5)

  const interceptor = (options, nextCall) => 
    new grpc.InterceptingCall(nextCall(options), {
      sendMessage: (message, next) => {
        t.is(message.name, 'Bob');
        next({ name: message.name + 2 });
      }
    });

  const client = caller(TEST_HOST, PROTO_PATH, 'helloworld.Greeter', false, {}, { options: { interceptors: [interceptor] } })
  client.sayHello({ name: 'Bob' }, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'Hello Bob2')
    t.end()
  })
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
