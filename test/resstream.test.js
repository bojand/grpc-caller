const _ = require('lodash')
const async = require('async')
const grpc = require('@grpc/grpc-js')
const path = require('path')
const protoLoader = require('@grpc/proto-loader')
const test = require('ava')

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/resstream.proto')
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
  function listStuff (call) {
    const reqMsg = call.request.message
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

    async.eachSeries(
      data,
      (d, asfn) => {
        const ret = { message: d.message + ':' + reqMsg }
        if (meta) {
          ret.metadata = meta
        }
        call.write(ret)
        _.delay(asfn, _.random(50, 150))
      },
      () => {
        call.end()
      }
    )
  }

  const server = new grpc.Server()
  server.addService(argProto.ArgService.service, { listStuff })
  await new Promise((resolve, reject) => {
    server.bindAsync(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure(),
      (err, result) => (err ? reject(err) : resolve(result))
    )
  })
  server.start()
  apps.push(server)
})

test.cb('res stream call service using just an argument', t => {
  t.plan(1)
  let resData = []
  const call = client.listStuff({ message: 'Hello' })
  call.on('data', d => resData.push(d))
  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      return { message: d.message + ':Hello' }
    })

    t.deepEqual(resData, expected)
    t.end()
  })
})

test.cb('call service with metadata as plain object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime()
  const call = client.listStuff({ message: 'Hi' }, { requestId: 'bar-123', timestamp: ts })
  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message + ':Hi'
      d.metadata = { requestid: 'bar-123', timestamp: ts.toString() }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })
})

test.cb('call service with metadata as Metadata', t => {
  t.plan(1)
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)

  let resData = []

  const call = client.listStuff({ message: 'Yo' }, reqMeta)
  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message + ':Yo'
      d.metadata = { requestid: 'bar-123', timestamp: ts }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })
})

test.cb('call service with metadata as plain object and options object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime()
  const call = client.listStuff(
    { message: 'Hello' },
    { requestId: 'bar-123', timestamp: ts },
    { some: 'blah' }
  )
  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message + ':Hello'
      d.metadata = { requestid: 'bar-123', timestamp: ts.toString() }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })
})

test.cb('call service with metadata as Metadata and options object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const call = client.listStuff({ message: 'Hello' }, reqMeta, { some: 'blah' })
  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message + ':Hello'
      d.metadata = { requestid: 'bar-123', timestamp: ts }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })
})

test('Request API: should fail due to unsupported call type', t => {
  const error = t.throws(() => {
    const req = new client.Request('listStuff', { message: 'Hello' })

    req.exec()
  })

  t.truthy(error)
  t.is(error.message, 'Invalid call: listStuff cannot be called using Request API')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
