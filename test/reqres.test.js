import _ from 'lodash'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/reqres.proto')
const argProto = grpc.load(PROTO_PATH).argservice

const apps = []

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const DYNAMIC_HOST = getHost()
const client = caller(DYNAMIC_HOST, PROTO_PATH, 'ArgService')

test.before('should dynamically create service', t => {
  function doSomething (call, callback) {
    const ret = { message: call.request.message }
    if (call.metadata) {
      const meta = call.metadata.getMap()
      if (meta['user-agent']) {
        delete meta['user-agent']
      }
      if (!_.isEmpty(meta)) {
        ret.metadata = JSON.stringify(meta)
      }
    }
    callback(null, ret)
  }

  const server = new grpc.Server()
  server.addService(argProto.ArgService.service, { doSomething })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test.cb('call service using callback and just an argument', t => {
  t.plan(5)
  client.doSomething({ message: 'Hello' }, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.falsy(response.metadata)
    t.is(response.message, 'Hello')
    t.end()
  })
})

test('call service using async with just an argument', async t => {
  t.plan(4)
  const response = await client.doSomething({ message: 'Hi' })
  t.truthy(response)
  t.truthy(response.message)
  t.falsy(response.metadata)
  t.is(response.message, 'Hi')
})

test.cb('call service using callback with metadata as plain object', t => {
  t.plan(6)
  const ts = new Date().getTime()
  client.doSomething({ message: 'Hello' }, { requestId: 'bar-123', timestamp: ts }, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'Hello')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })
})

test('call service using async with metadata as plain object', async t => {
  t.plan(5)
  const ts = new Date().getTime()
  const response = await client.doSomething({ message: 'Hi' }, { requestId: 'bar-123', timestamp: ts })
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'Hi')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test.cb('call service using callback with metadata as Metadata', t => {
  t.plan(6)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  client.doSomething({ message: 'Hello' }, reqMeta, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'Hello')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts }
    t.deepEqual(metadata, expected)
    t.end()
  })
})

test('call service using async with metadata as Metadata', async t => {
  t.plan(5)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const response = await client.doSomething({ message: 'Hi' }, reqMeta)
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'Hi')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts }
  t.deepEqual(metadata, expected)
})

test.cb('call service using callback with metadata as plain object and options object', t => {
  t.plan(6)
  const ts = new Date().getTime()
  client.doSomething({ message: 'Hello' }, { requestId: 'bar-123', timestamp: ts }, { some: 'blah' }, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'Hello')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })
})

test('call service using async with metadata as plain object and options object', async t => {
  t.plan(5)
  const ts = new Date().getTime()
  const response = await client.doSomething({ message: 'Hi' }, { requestId: 'bar-123', timestamp: ts }, { some: 'blah' })
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'Hi')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test.cb('call service using callback with metadata as Metadata and options object', t => {
  t.plan(6)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  client.doSomething({ message: 'Hello' }, reqMeta, { some: 'blah' }, (err, response) => {
    t.ifError(err)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, 'Hello')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts }
    t.deepEqual(metadata, expected)
    t.end()
  })
})

test('call service using async with metadata as Metadata and options object', async t => {
  t.plan(5)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const response = await client.doSomething({ message: 'Hi' }, reqMeta, { some: 'blah' })
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'Hi')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts }
  t.deepEqual(metadata, expected)
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
