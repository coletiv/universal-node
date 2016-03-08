/*

 server.js
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

var fs = require('fs');
var util = require('util');
var https = require('https');
var express = require('express');
var ws = new require('ws');
var BeApiSession = require('./lib/session');
var BeApiWebsocket = require('./lib/websocket');

// Flag used to disable certain features
var developer_mode = process.env.DEV_MODE || false;

// Flag to enable HTTPS
var useSSL = process.env.USE_SSL || true;

// Server port and credentials
var HTTP_HOST = process.env.HTTP_HOST || '0.0.0.0';
var port = useSSL ? 443 : 8080;
var key = fs.readFileSync('ssl-certificates/localhost_key.pem', 'utf8');
var certificate = fs.readFileSync('ssl-certificates/localhost_cert.pem', 'utf8');
var credentials = {
  key: key,
  cert: certificate
};

// Logs

var logs = function(message) {
  console.log(message);
};

// Transport Session

var static_sharedSecret = "367b254f4f5c453b662b614038316f7123332a793366436b41383e433d";

var sessions = []; // contains all the sessions

// Transport Session (Actions and Events)

function transportSessionAuthenticate(session, object) {
  logs("transportSessionAuthenticate");

  if (session.state === "connected" && object.shared_secret === static_sharedSecret) {
    logs("transportSessionAuthenticate 'Success'");

    var token;

    if (object.token) {
      token = object.token;
    }

    session.didAuthenticateWithUserId(object.user_id, token);
    sessions.push(session);

    session.sendMessage(["session", "authenticated", {
      "user_id": session.userId,
      "shared_secret": static_sharedSecret
    }]);    

  } else {
    logs("transportSessionAuthenticate 'Failed'");
    transportSessionClose(session, object);
  }
}

function transportSessionClose(session, object) {
  logs("transportSessionClose");

  session.didClose();

  var indexOfSession = sessions.indexOf(session);

  if (indexOfSession > -1) {
    sessions.splice(indexOfSession, 1);
  }
}

function transportSessionNetworkFound(session, timestamp) {

  // Check & Log public Ip
  logs(" + Network found: ");
}

// Transport Session (Connection)

function transportSessionDidReceiveMessage(session, message) {
  logs("transportSessionDidReceiveMessage");
  logs(message);

  // TODO Error handling, in case message is not in the correct format
  var type = message[0];
  var action = message[1];
  var object = message[2];

  // Check if the session is 'authenticated'
  if (session.state !== "authenticated") {

    // Expected 'session' 'authenticate'
    if (type === "session" && action === "authenticate") {

      // Check credentials
      transportSessionAuthenticate(session, object);

    } else {

      // Unexpected, force the session's connection to close
      transportSessionClose(session, object);
    }

  } else {

    // User session
    if (type === "session") {
      if (action === "close") {
        transportSessionClose(session, object);
      }
    }

    // Network
    if (type === "network") {
      if (action === "found") {
        transportSessionNetworkFound(session, object.timestamp);
      }
    }    
  }
}

var websocketServer;

if (useSSL) {
  var httpsServer = https.createServer(credentials, express()).listen(port); // Use HTTPS server
  websocketServer = new ws.Server({
    server: httpsServer
  }); // Instantiate the WSS server
} else {
  websocketServer = new ws.Server({
    host: HTTP_HOST,
    port: port
  }); // Instantiate the WS server
}

websocketServer.on('connection', function connection(websocket) {

  var socketWrapper = new BeApiWebsocket.BeApiWebsocket(websocket);
  var session = new BeApiSession.BeApiSession(socketWrapper);
  session.didConnect();

  websocket.on('close', function closeEvent(code, data) {
    session.didDisconnect();
  });

  websocket.on('error', function errorEvent(error) {
    // TODO
  });

  websocket.on('message', function messageEvent(data, flags) {
    var message = socketWrapper.unpackMessage(data);
    if (!util.isNullOrUndefined(message)) {
      transportSessionDidReceiveMessage(session, message);
    }
  });

});

logs("*** BinaryEdge Fortity API Server (Port:" + port + ") ***");
