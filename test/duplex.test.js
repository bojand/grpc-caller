const _ = require('lodash')
const async = require('async')
const grpc = require('@grpc/grpc-js')
const path = require('path')
const protoLoader = require('@grpc/proto-loader')
const test = require('ava')

const caller = require('../')

const PROTO_PATH = path.resolve(__dirname, './protos/duplex.proto')
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
  function processStuff (call) {
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

    call.on('data', d => {
      call.pause()
      _.delay(() => {
        const ret = { message: d.message.toUpperCase() }
        if (meta) {
          ret.metadata = meta
        }
        call.write(ret)
        call.resume()
      }, _.random(50, 150))
    })

    call.on('end', () => {
      _.delay(() => {
        // async.doWhilst(cb => process.nextTick(cb), () => {
        //   return counter < 5
        // }, () => {
        call.end()
        // })
      }, 200)
    })
  }

  const server = new grpc.Server()
  server.addService(argProto.ArgService.service, { processStuff })
  await new Promise((resolve, reject) => {
    server.bindAsync(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure(),
      (err, result) => (err ? reject(err) : resolve(result))
    )
  })
  server.start()
  apps.push(server)
})

test.cb('Duplex: call service using just an argument', t => {
  t.plan(1)
  let resData = []

  const call = client.processStuff()

  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message.toUpperCase()
      d.metadata = ''
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    _.delay(() => {
      call.write(d)
      asfn()
    }, _.random(10, 50))
  }, () => {
    _.delay(() => call.end(), 50)
  })
})

test.cb('call service with metadata as plain object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime()
  const call = client.processStuff({ requestId: 'bar-123', timestamp: ts })

  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message.toUpperCase()
      d.metadata = { requestid: 'bar-123', timestamp: ts.toString() }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    _.delay(cb => {
      call.write(d)
      asfn()
    }, _.random(50, 100))
  }, () => {
    call.end()
  })
})

test.cb('call service with metadata as Metadata', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)
  const call = client.processStuff(reqMeta)

  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message.toUpperCase()
      d.metadata = { requestid: 'bar-123', timestamp: ts }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    _.delay(() => {
      call.write(d)
      asfn()
    }, _.random(10, 50))
  }, () => {
    _.delay(() => call.end(), 50)
  })
})

test.cb('call service with metadata as plain object and options object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime()
  const call = client.processStuff({ requestId: 'bar-123', timestamp: ts }, { some: 'blah' })

  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message.toUpperCase()
      d.metadata = { requestid: 'bar-123', timestamp: ts.toString() }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    _.delay(() => {
      call.write(d)
      asfn()
    }, _.random(10, 50))
  }, () => {
    _.delay(() => call.end(), 50)
  })
})

test.cb('call service with metadata as Metadata and options object', t => {
  t.plan(1)
  let resData = []
  const ts = new Date().getTime().toString()
  const reqMeta = new grpc.Metadata()
  reqMeta.add('requestId', 'bar-123')
  reqMeta.add('timestamp', ts)

  const call = client.processStuff(reqMeta, { some: 'blah' })

  call.on('data', d => {
    const metadata = d.metadata ? JSON.parse(d.metadata) : ''
    resData.push({ message: d.message, metadata })
  })

  call.on('end', () => {
    resData = _.sortBy(resData, 'message')

    let expected = _.cloneDeep(data)
    expected = _.map(expected, d => {
      d.message = d.message.toUpperCase()
      d.metadata = { requestid: 'bar-123', timestamp: ts }
      return d
    })

    t.deepEqual(resData, expected)
    t.end()
  })

  async.eachSeries(data, (d, asfn) => {
    _.delay(() => {
      call.write(d)
      asfn()
    }, _.random(10, 50))
  }, () => {
    _.delay(() => call.end(), 50)
  })
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
