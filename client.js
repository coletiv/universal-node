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
 Usage: node client.js --url <websocket url i.e. ws://127.0.0.1:8080>
 */

var ws                 = require('ws');
var msgpack            = require('msgpack');
var prompt             = require('prompt');
var program            = require('commander');
var universalSession   = require('./lib/session.js');
var universalWebsocket = require('./lib/websocket.js');

function userInputLoop(session) {
  console.log("\n*** Coletiv Universal/node Client ***");
  console.log("Please insert one of the following options:");
  console.log("1 - Send echo");

  prompt.get(['option'], function (err, result) {

    if (err) {
      console.log(err);
      userInputLoop();
    }

    executeUserOption(session, result.option);
    userInputLoop(session);
  });
}

function executeUserOption(session, userOption) {
  var type           = "";
  var action         = "";
  var message        = {};

  switch(userOption) {

    case '1': {
      type    = "message";
      action  = "echo";
      message = "Hello world!";
    } break;

    default: {
      console.log("Option not supported");
      return;
    } break;
  }

  session.sendMessage([type, action, message]);
}

// Transport Session (Actions)

function transportSessionAuthenticate(session) {
  console.log("transportSessionAuthenticate");  
  session.sendMessage(["session", "authenticate", {"shared_secret":session.sharedSecret, "user_id":session.userId}]);
}

// Transport Session (Events)

function transportSessionDidOpen(session) {
  console.log("transportSessionDidOpen");
  transportSessionAuthenticate(session);
}

function transportSessionDidClose(session) {
  console.log("closing down due to: websocket closed");
  exit();
}

function transportSessionDidReceiveMessage(session, data) {
  var message = session.websocket.unpackMessage(data);
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

function transportSessionDidAuthenticate(session) {
  console.log("transportSessionDidAuthenticate");
  
  prompt.start();
  userInputLoop(session);
}


process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Accept self-signed SSL certificates

program.option('--url <url>', 'Get the be-api-server websocket URL (ie. wss://api.coletiv.io)').parse(process.argv);

var websocket_url = (program.hasOwnProperty('url')) ? program.url : 'wss://api.coletiv.io' ;
console.log("Websocket URL: " + websocket_url);

var websocket = new ws(websocket_url); // Use SSL
var session = undefined;

websocket.on('open', function open() {  
  session = new universalSession.Session( (new universalWebsocket.Websocket(websocket)) );
  session.sharedSecret = "1728361872638323727987987ab123123";
  session.userId = "27aeae53-f5d3-429d-82a9-35d0355b875c";

  transportSessionDidOpen(session);
});

websocket.on('close', function close() {
  transportSessionDidClose(session);
});

websocket.on('message', function message(data, flags) {  
  transportSessionDidReceiveMessage(session, data);
});
