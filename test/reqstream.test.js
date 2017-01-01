import _ from 'lodash'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/reqstream.proto')
const argProto = grpc.load(PROTO_PATH).argservice

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

test.before('should dynamically create service', t => {
  function writeStuff (call, fn) {
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
      fn(null, ret)
    })
  }

  const server = new grpc.Server()
  server.addProtoService(argProto.ArgService.service, { writeStuff })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test.cb('call service using just an argument', t => {
  t.plan(5)
  const call = client.writeStuff((err, res) => {
    t.ifError(err)
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

test('call service using just an argument', async t => {
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
    t.ifError(err)
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
    t.ifError(err)
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
    t.ifError(err)
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
    t.ifError(err)
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

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
