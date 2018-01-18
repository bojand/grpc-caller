# grpc-caller

An improved [gRPC](http://www.grpc.io) client.

[![npm version](https://img.shields.io/npm/v/grpc-caller.svg?style=flat-square)](https://www.npmjs.com/package/grpc-caller)
[![build status](https://img.shields.io/travis/bojand/grpc-caller/master.svg?style=flat-square)](https://travis-ci.org/bojand/grpc-caller)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square)](https://standardjs.com)
[![License](https://img.shields.io/github/license/bojand/grpc-caller.svg?style=flat-square)](https://raw.githubusercontent.com/bojand/grpc-caller/master/LICENSE)

#### Features

* Promisifies request / response calls if no callback is supplied
* Promisifies request stream / response calls if no callback is supplied
* Automatically converts plain javascript object to metadata in calls.

## Installation

```
$ npm install grpc-caller
```

## Overview

#### Improved request / response calls

Works as standard gRPC client:

```js
const caller = require('grpc-caller')
const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')
const client = caller('0.0.0.0:50051', PROTO_PATH, 'Greeter')
client.sayHello({ name: 'Bob' }, (err, res) => {
  console.log(res)
})
```

For request / response calls, also promisified if callback is not provided:

```js
client.sayHello({ name: 'Bob' })
  .then(res => console.log(res))
```

Which means means you can use is with `async / await`

```js
const res = await client.sayHello({ name: 'Bob' })
console.log(res)
```

#### Improved request stream / response calls

Lets say we have a remote call `writeStuff` that accepts a stream of messages
and returns some result based on processing of the stream input.

Works as standard gRPC client:

```js
const call = client.writeStuff((err, res) => {
  if (err) console.error(err)
  console.log(res)
})

// ... write stuff to call
```

If no callback is provided we promisify the call such that it returns an **object
with two properties** `call` and `res` such that:

* `call` - the standard stream to write to as returned normally by grpc
* `res` - a promise that's resolved / rejected when the call is finished, in place of the callback.

Using destructuring we can do something like:

```js
const { call, res } = client.writeStuff()
res
  .then(res => console.log(res))
  .catch(err => console.error(err))

// ... write stuff to call
```

This means we can abstract the whole operation into a nicer promise returning
async function to use with `async / await`

```js
async function writeStuff() {
  const { call, res } = client.writeStuff()
  // ... write stuff to call
  return res
}

const res = await writeStuff()
console.log(res)
```

#### Automatic `Metadata` creation

All standard gRPC client calls accept [`Metadata`](http://www.grpc.io/grpc/node/module-src_metadata-Metadata.html)
as first or second parameter (depending on the call type). However one has to
manually create the Metadata object. This module uses
[grpc-create-metadata](https://www.github.com/bojand/grpc-create-metadata)
to automatically create Metadata if plain Javascript object is passed in.

```js
// the 2nd parameter will automatically be converted to gRPC Metadata and
// included in the request
const res = await client.sayHello({ name: 'Bob' }, { requestid: 'my-request-id-123' })
console.log(res)
```

We can still pass an actual `Metadata` object and it will be used as is:

```js
const meta = new grpc.Metadata()
meta.add('requestid', 'my-request-id-123')
const res = await client.sayHello({ name: 'Bob' }, meta)
console.log(res)
```

## API Reference

<a name="caller"></a>

### caller(host, proto, name, options) ⇒ <code>Object</code>
Create client isntance.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| host | <code>String</code> | The host to connect to |
| proto | <code>String</code> \| <code>Object</code> | Path to the protocol buffer definition file or                              Object specifying <code>root</code> directory and <code>file</code> to load or                              the static client constructor object itself |
| name | <code>String</code> | In case of proto path the name of the service as defined in the proto definition. |
| options | <code>Object</code> | Options to be passed to the gRPC client constructor |

**Example** *(Create client dynamically)*  
```js
const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')
const client = caller('localhost:50051', PROTO_PATH, 'Greeter')

const root = path.join(__dirname, 'protos');
const file = 'helloworld.proto'
const client = caller('localhost:50051', { root, file }, 'Greeter')
```
**Example** *(Create a static client)*  
```js
const services = require('./static/helloworld_grpc_pb')
const client = caller('localhost:50051', services.GreeterClient)
```
<a name="caller.metadata"></a>

#### caller.metadata
Utility helper function to create <code>Metadata</code> object from plain Javascript object.
See <code>grpc-create-metadata</code> module.

**Kind**: static property of [<code>caller</code>](#caller)  
## License

  Apache-2.0
