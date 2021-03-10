const _ = require('lodash')
const async = require('async')
const grpc = require('@grpc/grpc-js')
const path = require('path')
const protoLoader = require('@grpc/proto-loader')
const test = require('ava')

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/reqres.proto')
const packageDefinition = protoLoader.loadSync(PROTO_PATH)
const argProto = grpc.loadPackageDefinition(packageDefinition).argservice

const apps = []

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const DYNAMIC_HOST = getHost()
const client = caller(DYNAMIC_HOST, PROTO_PATH, 'ArgService')

let callCounter = 0

test.before('should dynamically create service', async (t) => {
  function doSomething (call, callback) {
    callCounter++
    const ret = { message: call.request.message }

    const md = new grpc.Metadata()
    md.set('headerMD', 'headerValue')
    call.sendMetadata(md)

    if (call.metadata) {
      const meta = call.metadata.getMap()
      if (meta['user-agent']) {
        delete meta['user-agent']
      }
      if (!_.isEmpty(meta)) {
        ret.metadata = JSON.stringify(meta)
      }
    }

    const md2 = new grpc.Metadata()
    md2.set('trailerMD', 'trailerValue')

    if (ret.message.toLowerCase() === 'bad' && callCounter < 3) {
      return callback(new Error('Bad Request'), null, md2)
    }

    callback(null, ret, md2)
  }

  const server = new grpc.Server()
  server.addService(argProto.ArgService.service, { doSomething })
  await new Promise((resolve, reject) => {
    server.bindAsync(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure(),
      (err, result) => (err ? reject(err) : resolve(result))
    )
  })
  server.start()
  apps.push(server)
})

test.serial.cb('Retry: call service using retry option and callback', t => {
  t.plan(6)

  callCounter = 0

  client.doSomething({ message: 'Bad' }, {}, { retry: 5 }, (err, response) => {
    t.falsy(err)
    t.truthy(response)
    t.truthy(response.message)
    t.falsy(response.metadata)
    t.is(response.message, 'Bad')
    t.is(callCounter, 3)
    t.end()
  })
})

test.serial('Retry: async call service using retry option', async t => {
  t.plan(5)

  callCounter = 0

  const response = await client.doSomething({ message: 'Bad' }, {}, { retry: 5 })
  t.is(callCounter, 3)
  t.truthy(response)
  t.truthy(response.message)
  t.falsy(response.metadata)
  t.is(response.message, 'Bad')
})

test.serial.cb('Request API with retry: call service using callback and just an argument', t => {
  t.plan(10)

  callCounter = 0

  const req = new client
    .Request('doSomething', { message: 'Bad' })
    .withRetry(5)

  req.exec((err, res) => {
    t.falsy(err)
    t.is(callCounter, 3)
    const { response } = res
    t.truthy(res.response)
    t.truthy(res.call)
    t.falsy(res.metadata)
    t.falsy(res.status)
    t.truthy(response)
    t.truthy(response.message)
    t.falsy(response.metadata)
    t.is(response.message, 'Bad')
    t.end()
  })
})

test.serial('Request API with retry: call service using async with just an argument', async t => {
  t.plan(9)

  callCounter = 0

  const req = new client
    .Request('doSomething', { message: 'Bad' })
    .withRetry(5)

  const res = await req.exec()

  t.is(callCounter, 3)

  const { response } = res
  t.truthy(res.response)
  t.truthy(res.call)
  t.falsy(res.metadata)
  t.falsy(res.status)
  t.truthy(response)
  t.truthy(response.message)
  t.falsy(response.metadata)
  t.is(response.message, 'Bad')
})

test.serial('Request API with retry: call service using async with metadata and options', async t => {
  t.plan(13)

  callCounter = 0

  const ts = new Date().getTime()

  const req = new client
    .Request('doSomething', { message: 'Bad' })
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseMetadata(true)
    .withResponseStatus(true)
    .withRetry(5)

  const res = await req.exec()

  t.is(callCounter, 3)

  t.truthy(res.metadata)
  const md1 = res.metadata.getMap()
  const expectedMd = { headermd: 'headerValue' }
  t.deepEqual({ headermd: md1.headermd }, expectedMd)

  t.truthy(res.status)
  t.is(res.status.code, 0)
  t.is(res.status.details, 'OK')
  t.truthy(res.status.metadata)
  const md2 = res.status.metadata.getMap()
  const expectedMd2 = { trailermd: 'trailerValue' }
  t.deepEqual(md2, expectedMd2)

  const { response } = res
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, 'Bad')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
