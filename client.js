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
 Usage: node client.js --url <websocket url i.e. ws://127.0.0.1> --port <port number i.e 8080>
  i.e.  node client.js --url ws://127.0.0.1 --port 8080
 */

var prompt          = require('prompt');
var program         = require('commander');
var universalModule = require('./lib/index.js');

function userInputLoop(session) {
  console.log('\n*** Coletiv Universal/node Client ***');
  console.log('Please insert one of the following options:');
  console.log('1 - Send echo');

  prompt.get(['option'], function (err, result) {

    if (err) {
      console.log(err);
      userInputLoop();
    }

    executeUserOption(session, result.option);    
  });
}

function executeUserOption(session, userOption) {
  var type     = '';
  var action   = '';
  var message  = '';

  switch(userOption) {

    case '1': {
      type    = 'message';
      action  = 'echo';
      message = 'Hello world!';
    } break;

    default: {
      console.log('Option not supported');
      return;
    } break;
  }

  var dataToSend = [type, action, message];
  console.log('sending: \'' + dataToSend + '\'');
  session.sendMessage(dataToSend);
}

// Transport Session (Events)

function didConnect(session) {
  console.log('didConnect');  

  prompt.start();
  userInputLoop(session);
}

function didClose(session) {
  console.log('didClose: closing down');
  
  process.exit(1);
}

function didReceiveMessage(session, message) {
  console.log('didReceiveMessage: session: ' + session + ' message \'' + message + '\'');

  userInputLoop(session);
}


program.option('--url <url>', 'server websocket URL (ie. wss://api.coletiv.io)')
       .option('--port <port>', 'server port (ie. 8080)')
       .parse(process.argv);

var url  = (program.hasOwnProperty('url')) ? program.url : 'wss://api.coletiv.io' ;
var port = (program.hasOwnProperty('port')) ? program.port : '443' ;

console.log('connecting to URL: ' + url + 'port: ' + port);

var SHARED_SECRET = '1728361872638323727987987ab123123'; 
var USER_ID = '27aeae53-f5d3-429d-82a9-35d0355b875c';

var node = new universalModule.UniversalNode();
node.connect(url, port, SHARED_SECRET, USER_ID, didConnect, didClose, didReceiveMessage);
