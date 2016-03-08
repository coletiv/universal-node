/*

 client.js
 universal-node

 Copyright (c) 2016 Coletiv

 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

/*
 Usage: node client.js --url <websocket url>
 */

var ws       = require('ws');
var msgpack  = require('msgpack');
var prompt   = require('prompt');
var program  = require('commander');

// Transport Session

var static_sharedSecret = "367b254f4f5c453b662b614038316f7123332a793366436b41383e433d";
var static_userId = "27aeae53-f5d3-429d-82a9-35d0355b875c";

function Session(sharedSecret, userId) {
  this.sharedSecret = sharedSecret;
  this.userId = userId;
  this.state = "idle"; // {idle, authenticating, authenticated}
  this.websocket = undefined;
}

var session = new Session(static_sharedSecret, static_userId);

// Transport Session (Actions and Events)

function transportSessionAuthenticate(session) {
  console.log("transportSessionAuthenticate");
  session.state = "authenticating";
  transportSessionSendMessage(session, ["session", "authenticate", {"shared_secret":session.sharedSecret, "user_id":session.userId}]);
}

function transportSessionDidAuthenticate(session) {
  console.log("transportSessionDidAuthenticate");
  session.state = "authenticated";

  prompt.start();
  userInputLoop(session);
}

function userInputLoop(session) {
  console.log("\n*** Coletiv Universal/node Client ***");
  console.log("Please insert one of the following options:");
  console.log("1 - Send network found");

  prompt.get(['option'], function (err, result) {

    if (err) {
      console.log(err);
      userInputLoop();
    }

    executeUserOption(session, result.option);
    userInputLoop(session);
  });
}

function getNetworkFoundMessageFromMockData() {
  return {
    timestamp: new Date().toISOString(),  // UTC Timestamp (ISO 8601)    
  };
}


function executeUserOption(session, userOption) {
  var type           = "";
  var action         = "";
  var message        = {};

  switch(userOption) {

    case '1': {
      type    = "network";
      action  = "found";
      message = getNetworkFoundMessageFromMockData();
    } break;

    default: {
      console.log("Option not supported");
      return;
    } break;
  }

  transportSessionSendMessage(session, [type, action, message]);
}

function transportSessionClose(session) {
  console.log("transportSessionClose");
  session.state = "idle";
  transportSessionSendMessage(session, ["session", "close", {}]);
}

// Transport Session (Connection)

function transportSessionDidConnect(websocket) {
  console.log("transportSessionDidConnect");
  session.websocket = websocket;
  transportSessionAuthenticate(session);
}

function transportSessionDidDisconnect(websocket) {
  console.log("transportSessionDidDisconnect");
  session.websocket = undefined;
  // TODO Retry to re-establish a new connection
}

function transportSessionDidReceiveMessage(websocket, message) {
  console.log("transportSessionDidReceiveMessage", message);
  var type = message[0];
  var action = message[1];
  var object = message[2];

  if (type == "session") {
    if (action == "authenticated") {
      transportSessionDidAuthenticate(session);
    }
  }
}

function transportSessionSendMessage(session, message) {
  console.log("transportSessionSendMessage", message);
  if (session.websocket !== undefined) {
    transportWebsocketWrite(session.websocket, message);
  }
}

// Transport Message

function transportMessagePack(message) {
  var data = msgpack.pack(message);
  return data;
}

function transportMessageUnpack(data) {
  var message = msgpack.unpack(data);
  return message;
}

// Transport Websocket

function transportWebsocketDidOpen(websocket) {
  transportSessionDidConnect(websocket);
}

function transportWebsocketDidClose(websocket) {
  transportSessionDidDisconnect(websocket);
}

function transportWebsocketDidRead(websocket, data) {
  var message = transportMessageUnpack(data);
  transportSessionDidReceiveMessage(websocket, message);
}

function transportWebsocketWrite(websocket, message) {
  var data = transportMessagePack(message);
  websocket.send(data, { binary: true, mask: true });
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Accept self-signed SSL certificates

// Websocket (Client)

program.option('--url <url>', 'Get the be-api-server websocket URL (ie. wss://api.coletiv.io)').parse(process.argv);
var websocket_url = (program.hasOwnProperty('url')) ? program.url : 'wss://api.coletiv.io' ;
var websocket = new ws(websocket_url); // Use SSL

console.log("Websocket URL: " + websocket_url);

websocket.on('open', function open() {
  transportWebsocketDidOpen(websocket);
});

websocket.on('close', function close() {
  transportWebsocketDidClose(websocket);
});

websocket.on('message', function message(data, flags) {
  transportWebsocketDidRead(websocket, data);
});
