const _ = require('lodash')
const async = require('async')
const grpc = require('@grpc/grpc-js')
const path = require('path')
const protoLoader = require('@grpc/proto-loader')
const test = require('ava')

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/reqstream.proto')
const packageDefinition = protoLoader.loadSync(PROTO_PATH)
const argProto = grpc.loadPackageDefinition(packageDefinition).argservice

const apps = []

const data = [
  { message: '1 foo' },
  { message: '2 bar' },
  { message: '3 asd' },
  { message: '4 qwe' },
  { message: '5 rty' },
  { message: '6 zxc' }
]

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const DYNAMIC_HOST = getHost()
const client = caller(DYNAMIC_HOST, PROTO_PATH, 'ArgService')

test.before('should dynamically create service', async (t) => {
  function writeStuff (call, fn) {
    const md = new grpc.Metadata()
    md.set('headerMD', 'headerValue')
    call.sendMetadata(md)

    let meta = null
    if (call.metadata) {
      const reqMeta = call.metadata.getMap()
      if (reqMeta['user-agent']) {
        delete reqMeta['user-agent']
      }
      if (!_.isEmpty(reqMeta)) {
        meta = JSON.stringify(reqMeta)
      }
    }

    let counter = 0
    const received = []
    call.on('data', d => {
      counter += 1
      received.push(d.message)
    })

    call.on('end', () => {
      const ret = {
        message: received.join(':').concat(':' + counter)
      }

      if (meta) {
        ret.metadata = meta
      }

      const md2 = new grpc.Metadata()
      md2.set('trailerMD', 'trailerValue')

      fn(null, ret, md2)
    })
  }

  const server = new grpc.Server()
  server.addService(argProto.ArgService.service, { writeStuff })
  await new Promise((resolve, reject) => {
    server.bindAsync(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure(),
      (err, result) => (err ? reject(err) : resolve(result))
    )
  })
  server.start()
  apps.push(server)
})

test.cb('Reqres: call service using just an argument', t => {
  t.plan(5)
  const call = client.writeStuff((err, res) => {
    t.falsy(err)
    t.truthy(res)
    t.truthy(res.message)
    t.falsy(res.metadata)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('promised call service using just an argument', t => {
  t.plan(4)
  const { call, res } = client.writeStuff()
  res.then(res => {
    t.truthy(res)
    t.truthy(res.message)
    t.falsy(res.metadata)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test('async call service using just an argument', async t => {
  t.plan(4)

  async function writeStuff () {
    const { call, res } = client.writeStuff()

    async.eachSeries(data, (d, asfn) => {
      call.write(d)
      _.delay(asfn, _.random(50, 150))
    }, () => {
      call.end()
    })

    return res
  }

  const result = await writeStuff()
  t.truthy(result)
  t.truthy(result.message)
  t.falsy(result.metadata)
  t.is(result.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
})

test.cb('call service with metadata as plain object', t => {
  t.plan(6)
  const ts = new Date().getTime()
  const call = client.writeStuff({ requestId: 'bar-123', timestamp: ts }, (err, res) => {
    t.falsy(err)
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('promised call service with metadata as plain object', t => {
  t.plan(5)
  const ts = new Date().getTime()
  const { call, res } = client.writeStuff({ requestId: 'bar-123', timestamp: ts })
  res.then(res => {
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('call service with metadata as Metadata', t => {
  t.plan(6)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const call = client.writeStuff(reqMeta, (err, res) => {
    t.falsy(err)
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('call service with metadata as plain object and options object', t => {
  t.plan(6)
  const ts = new Date().getTime()
  const call = client.writeStuff({ requestId: 'bar-123', timestamp: ts }, { some: 'blah' }, (err, res) => {
    t.falsy(err)
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('promised call service with metadata as plain object and options object', t => {
  t.plan(5)
  const ts = new Date().getTime()
  const { call, res } = client.writeStuff({ requestId: 'bar-123', timestamp: ts }, { some: 'blah' })
  res.then(res => {
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('call service with metadata as Metadata and options object', t => {
  t.plan(6)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const call = client.writeStuff(reqMeta, { some: 'blah' }, (err, res) => {
    t.falsy(err)
    t.truthy(res)
    t.truthy(res.message)
    t.is(res.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(res.metadata)
    const metadata = JSON.parse(res.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test.cb('Request API: call service using callback and just an argument', t => {
  t.plan(9)
  const req = new client.Request('writeStuff')
  const call = req.exec((err, res) => {
    t.falsy(err)
    const { response } = res
    t.truthy(res.response)
    t.truthy(res.call)
    t.falsy(res.metadata)
    t.falsy(res.status)
    t.truthy(response)
    t.truthy(response.message)
    t.falsy(response.metadata)
    t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test('Request API: async call service using just an argument', async t => {
  t.plan(8)
  const req = new client.Request('writeStuff')
  const { call, res: p } = req.exec()

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })

  const res = await p
  const { response } = res
  t.truthy(res.response)
  t.truthy(res.call)
  t.falsy(res.metadata)
  t.falsy(res.status)
  t.truthy(response)
  t.truthy(response.message)
  t.falsy(response.metadata)
  t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
})

test.cb('Request API: call service using callback with metadata as plain object', t => {
  t.plan(10)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })

  const call = req.exec((err, res) => {
    t.falsy(err)
    const { response } = res
    t.truthy(res.response)
    t.truthy(res.call)
    t.falsy(res.metadata)
    t.falsy(res.status)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test('Request API: async call service with metadata as plain object', async t => {
  t.plan(9)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })

  const { call, res: p } = req.exec()

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })

  const res = await p
  const { response } = res
  t.truthy(res.response)
  t.truthy(res.call)
  t.falsy(res.metadata)
  t.falsy(res.status)
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test('Request API: async call with metadata options', async t => {
  t.plan(12)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseMetadata(true)

  const { call, res: p } = req.exec()

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })

  const res = await p

  t.truthy(res.call)
  t.truthy(res.metadata)
  const md1 = res.metadata.getMap()
  const expectedMd = { headermd: 'headerValue' }
  t.deepEqual({ headermd: md1.headermd }, expectedMd)

  t.falsy(res.status)

  const { response } = res

  t.truthy(res.response)
  t.truthy(res.call)
  t.falsy(res.status)
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test.cb('Request API: callback call with metadata options', t => {
  t.plan(13)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseMetadata(true)

  const call = req.exec((err, res) => {
    t.falsy(err)
    t.truthy(res.call)
    t.truthy(res.metadata)
    const md1 = res.metadata.getMap()
    const expectedMd = { headermd: 'headerValue' }
    t.deepEqual({ headermd: md1.headermd }, expectedMd)

    t.falsy(res.status)

    const { response } = res

    t.truthy(res.response)
    t.truthy(res.call)
    t.falsy(res.status)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test('Request API: async call with status options', async t => {
  t.plan(15)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseMetadata(true)
    .withResponseStatus(true)

  const { call, res: p } = req.exec()

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })

  const res = await p

  t.truthy(res.call)
  t.truthy(res.metadata)
  const md1 = res.metadata.getMap()
  const expectedMd = { headermd: 'headerValue' }
  t.deepEqual({ headermd: md1.headermd }, expectedMd)

  t.truthy(res.status)
  t.is(res.status.code, 0)
  t.is(res.status.details, 'OK')
  t.truthy(res.status.metadata)
  const statusMD = res.status.metadata.getMap()
  const expectedStatusMD = { trailermd: 'trailerValue' }
  t.deepEqual(statusMD, expectedStatusMD)

  const { response } = res

  t.truthy(res.response)
  t.truthy(res.call)
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test.cb('Request API: callback call with status options', t => {
  t.plan(16)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseMetadata(true)
    .withResponseStatus(true)

  const call = req.exec((err, res) => {
    t.falsy(err)

    t.truthy(res.call)
    t.truthy(res.metadata)
    const md1 = res.metadata.getMap()
    const expectedMd = { headermd: 'headerValue' }
    t.deepEqual({ headermd: md1.headermd }, expectedMd)

    t.truthy(res.status)
    t.is(res.status.code, 0)
    t.is(res.status.details, 'OK')
    t.truthy(res.status.metadata)
    const statusMD = res.status.metadata.getMap()
    const expectedStatusMD = { trailermd: 'trailerValue' }
    t.deepEqual(statusMD, expectedStatusMD)

    const { response } = res

    t.truthy(res.response)
    t.truthy(res.call)
    t.truthy(response)
    t.truthy(response.message)
    t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
    t.truthy(response.metadata)
    const metadata = JSON.parse(response.metadata)
    const expected = { requestid: 'bar-123', timestamp: ts.toString() }
    t.deepEqual(metadata, expected)

    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })
})

test('Request API: async call with metadata and status options', async t => {
  t.plan(14)

  const ts = new Date().getTime()
  const req = new client.Request('writeStuff')
    .withMetadata({ requestId: 'bar-123', timestamp: ts })
    .withResponseStatus(true)

  const { call, res: p } = req.exec()

  async.eachSeries(data, (d, asfn) => {
    call.write(d)
    _.delay(asfn, _.random(50, 150))
  }, () => {
    call.end()
  })

  const res = await p

  t.truthy(res.call)
  t.falsy(res.metadata)
  t.truthy(res.status)
  t.is(res.status.code, 0)
  t.is(res.status.details, 'OK')
  t.truthy(res.status.metadata)
  const md1 = res.status.metadata.getMap()
  const expectedMd = { trailermd: 'trailerValue' }
  t.deepEqual(md1, expectedMd)

  const { response } = res

  t.truthy(res.response)
  t.truthy(res.call)
  t.truthy(response)
  t.truthy(response.message)
  t.is(response.message, '1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6')
  t.truthy(response.metadata)
  const metadata = JSON.parse(response.metadata)
  const expected = { requestid: 'bar-123', timestamp: ts.toString() }
  t.deepEqual(metadata, expected)
})

test('Request API: expect to throw on unknown client method', t => {
  const error = t.throws(() => {
    const ts = new Date().getTime()
    const req = new client.Request('asdf')
      .withMetadata({ requestId: 'bar-123', timestamp: ts })
      .withResponseStatus(true)

    req.exec()
  })

  t.truthy(error)
  t.is(error.message, 'Invalid method: asdf')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
