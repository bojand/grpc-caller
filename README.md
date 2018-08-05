# grpc-caller

An improved [gRPC](http://www.grpc.io) client.

[![npm version](https://img.shields.io/npm/v/grpc-caller.svg?style=flat-square)](https://www.npmjs.com/package/grpc-caller)
[![build status](https://img.shields.io/travis/bojand/grpc-caller/master.svg?style=flat-square)](https://travis-ci.org/bojand/grpc-caller)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square)](https://standardjs.com)
[![License](https://img.shields.io/github/license/bojand/grpc-caller.svg?style=flat-square)](https://raw.githubusercontent.com/bojand/grpc-caller/master/LICENSE)
[![Greenkeeper badge](https://badges.greenkeeper.io/bojand/grpc-caller.svg?style=flat-square)](https://greenkeeper.io/)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?style=flat-square)](https://www.paypal.me/bojandj)
[![Buy me a coffee](https://img.shields.io/badge/buy%20me-a%20coffee-orange.svg?style=flat-square)](https://www.buymeacoffee.com/bojand)

#### Features

* Promisifies request / response (Unary) calls if no callback is supplied
* Promisifies request stream / response calls if no callback is supplied
* Automatically converts plain javascript object to metadata in calls.
* Adds optional retry functionality to request / response (Unary) calls.
* Exposes expanded `Request` API for collecting metadata and status.

## Installation

```
$ npm install grpc-caller
```

## Overview

#### Improved unary calls

Works as standard gRPC client:

```js
const caller = require('grpc-caller')
const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')
const client = caller('0.0.0.0:50051', PROTO_PATH, 'Greeter')
client.sayHello({ name: 'Bob' }, (err, res) => {
  console.log(res)
})
```

For unary calls, also promisified if callback is not provided:

```js
client.sayHello({ name: 'Bob' })
  .then(res => console.log(res))
```

Which means means you can use is with `async / await`

```js
const res = await client.sayHello({ name: 'Bob' })
console.log(res)
```

For Unary calls we expose `retry` option identical to [async.retry](http://caolan.github.io/async/docs.html#retry).

```
const res = await client.sayHello({ name: 'Bob' }, {}, { retry: 3 })
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

## Request API

In addition to simple API above, the library provides a more detailed `"Request"` API that can 
be used to control the call details. The API can only be used for Unary and 
request streaming calls.

#### Unary calls

```js
const req = new client
  .Request('sayHello', { name: 'Bob' }) // call method name and argument
  .withMetadata({ requestId: 'bar-123' }) // call request metadata
  .withResponseMetadata(true) // we want to collect response metadata
  .withResponseStatus(true) // we want to collect the response status
  .withRetry(5) // retry options

const res = await req.exec()  
// res is an instance of our `Response`
// we can also call exec() using a callback

console.log(res.response) // the actual response data { message: 'Hello Bob!' }
console.log(res.metadata) // the response metadata
console.log(res.status)   // the response status
console.log(res.call)     // the internal gRPC call
```

#### Request streaming calls

In case of request streaming calls if `exec()` is called with a callback the gRPC `call` stream is returned.
If no callback is provided an object is returned with `call` property being the call stream and `res`
property being a Promise fulfilled when the call is completed. There is no `retry` option for 
request streaming calls.

```js

const req = new client.Request('writeStuff') // the call method name
    .withMetadata({ requestId: 'bar-123' })  // the call request metadata
    .withResponseMetadata(true) // we want to collect response metadata
    .withResponseStatus(true)   // we want to collect the response status

const { call, res: resPromise } = req.exec()

// ... write data to call

const res = await resPromise // res is our `Response`

console.log(res.response) // the actual response data
console.log(res.metadata) // the response metadata
console.log(res.status)   // the response status
console.log(res.call)     // the internal gRPC call
```

## API Reference

<a name="Request"></a>

### Request
A Request class that encapsulates the request of a call.

**Kind**: global class  

* [Request](#Request)
    * [new Request(methodName, param)](#new_Request_new)
    * [.withGrpcOptions(opts)](#Request+withGrpcOptions) ⇒ <code>Object</code>
    * [.withMetadata(opts)](#Request+withMetadata) ⇒ <code>Object</code>
    * [.withRetry(retry)](#Request+withRetry) ⇒ <code>Object</code>
    * [.withResponseMetadata(value)](#Request+withResponseMetadata) ⇒ <code>Object</code>
    * [.withResponseStatus(value)](#Request+withResponseStatus) ⇒ <code>Object</code>
    * [.exec(fn)](#Request+exec) ⇒ <code>Promise</code> \| <code>Object</code>

<a name="new_Request_new"></a>

#### new Request(methodName, param)
Creates a Request instance.


| Param | Type | Description |
| --- | --- | --- |
| methodName | <code>String</code> | the method name. |
| param | <code>\*</code> | the call argument in case of `UNARY` calls. |

<a name="Request+withGrpcOptions"></a>

#### request.withGrpcOptions(opts) ⇒ <code>Object</code>
Create a request with call options.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Object</code> - the request instance.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | The gRPC call options. |

<a name="Request+withMetadata"></a>

#### request.withMetadata(opts) ⇒ <code>Object</code>
Create a request with call metadata.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Object</code> - the request instance.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | The gRPC call metadata.                      Can either be a plain object or an instance of `grpc.Metadata`. |

<a name="Request+withRetry"></a>

#### request.withRetry(retry) ⇒ <code>Object</code>
Create a request with retry options.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Object</code> - the request instance.  

| Param | Type | Description |
| --- | --- | --- |
| retry | <code>Number</code> \| <code>Object</code> | The retry options. Identical to `async.retry`. |

<a name="Request+withResponseMetadata"></a>

#### request.withResponseMetadata(value) ⇒ <code>Object</code>
Create a request indicating whether we want to collect the response metadata.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Object</code> - the request instance.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>Boolean</code> | `true` to collect the response metadata. Default `false`. |

<a name="Request+withResponseStatus"></a>

#### request.withResponseStatus(value) ⇒ <code>Object</code>
Create a request indicating whether we want to collect the response status metadata.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Object</code> - the request instance.  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>Boolean</code> | `true` to collect the response status metadata. Default `false`. |

<a name="Request+exec"></a>

#### request.exec(fn) ⇒ <code>Promise</code> \| <code>Object</code>
Execute the request.

**Kind**: instance method of [<code>Request</code>](#Request)  
**Returns**: <code>Promise</code> \| <code>Object</code> - If no callback is provided in case of `UNARY` call a Promise is returned.
                         If no callback is provided in case of `REQUEST_STREAMING` call an object is
                         returned with `call` property being the call stream and `res`
                         property being a Promise fulfilled when the call is completed.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | Optional callback |

<a name="Response"></a>

### Response
A Response class that encapsulates the response of a call using the `Request` API.

**Kind**: global class  

* [Response](#Response)
    * [.call](#Response+call) : <code>Object</code>
    * [.response](#Response+response) : <code>Object</code>
    * [.metadata](#Response+metadata) : <code>Object</code>
    * [.status](#Response+status) : <code>Object</code>

<a name="Response+call"></a>

#### response.call : <code>Object</code>
The response's gRPC call.

**Kind**: instance property of [<code>Response</code>](#Response)  
<a name="Response+response"></a>

#### response.response : <code>Object</code>
The actual response data from the call.

**Kind**: instance property of [<code>Response</code>](#Response)  
<a name="Response+metadata"></a>

#### response.metadata : <code>Object</code>
The response metadata.

**Kind**: instance property of [<code>Response</code>](#Response)  
<a name="Response+status"></a>

#### response.status : <code>Object</code>
The response status metadata.

**Kind**: instance property of [<code>Response</code>](#Response)  
<a name="caller"></a>

### caller(host, proto, name, credentials, options) ⇒ <code>Object</code>
Create client isntance.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| host | <code>String</code> | The host to connect to |
| proto | <code>String</code> \| <code>Object</code> | Path to the protocol buffer definition file or                              Object specifying <code>file</code> to load and <code>load</code> options for proto loader. |
| name | <code>String</code> | In case of proto path the name of the service as defined in the proto definition. |
| credentials | <code>Object</code> | The credentials to use to connect. Defaults to `grpc.credentials.createInsecure()` |
| options | <code>Object</code> | Options to be passed to the gRPC client constructor |
| options.retry | <code>Object</code> | In addition to gRPC client constructor options, we accept a `retry` option.                                 The retry option is identical to `async.retry` and is passed as is to it.                                 This is used only for `UNARY` calls to add automatic retry capability. |

**Example** *(Create client dynamically)*  
```js
const PROTO_PATH = path.resolve(__dirname, './protos/helloworld.proto')
const client = caller('localhost:50051', PROTO_PATH, 'Greeter')
```
**Example** *(With options)*  
```js
const file = path.join(__dirname, 'helloworld.proto')
const load = {
  // ... proto-loader load options
}
const client = caller('localhost:50051', { file, load }, 'Greeter')
```
**Example** *(Create a static client)*  
```js
const services = require('./static/helloworld_grpc_pb')
const client = caller('localhost:50051', services.GreeterClient)
```

* [caller(host, proto, name, credentials, options)](#caller) ⇒ <code>Object</code>
    * [.metadata](#caller.metadata)
    * [.wrap](#caller.wrap)

<a name="caller.metadata"></a>

#### caller.metadata
Utility helper function to create <code>Metadata</code> object from plain Javascript object.
See <code>grpc-create-metadata</code> module.

**Kind**: static property of [<code>caller</code>](#caller)  
<a name="caller.wrap"></a>

#### caller.wrap
Utility function that can be used to wrap an already constructed client instance.

**Kind**: static property of [<code>caller</code>](#caller)  
## License

  Apache-2.0
