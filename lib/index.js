/*

 idnex.js
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

var fs                = require('fs');
var util              = require('util');
var https             = require('https');
var express           = require('express');
var ws                = require('ws');
var universalSession  = require('./session');

exports.UniversalNode = function(sharedSecret) {
  var self = this;

  // Transport Session (Actions and Events)

  function transportSessionAuthenticate(session, object) {
    console.log("transportSessionAuthenticate");

    if (session.isConnected() && object.shared_secret === self.sharedSecret) {
      console.log("transportSessionAuthenticate 'Success'");

      var token = undefined;

      if (object.token) {
        token = object.token;
      }

      session.didAuthenticateWithUserId(object.user_id, token);        

      session.sendMessage(["session", "authenticated", {
        "user_id": session.userId,
        "shared_secret": session.sharedSecret
      }]);    

    } else {
      console.log("transportSessionAuthenticate 'Failed'");
      transportSessionClose(session, object);
    }
  }

  function transportSessionClose(session, object) {
    console.log("transportSessionClose");

    session.didClose();  
  }

  function transportSessionEcho(session, message) {  
    console.log("\nsending: \"" + message + "\" back");

    session.sendMessage(message)
  }

  function transportSessionDidReceiveMessage(session, message, messageReceivedCallback) {
    console.log("transportSessionDidReceiveMessage: " + message);  

    var type   = message[0];
    var action = message[1];
    var object = message[2];

    // Check if the session is 'authenticated'
    if (session.isAuthenticated() === false) {    

      var isSessionAuthenticateMessage = (type === "session") && (action === "authenticate");

      // Expected 'session' 'authenticate'
      if (isSessionAuthenticateMessage === true) {
        // Check credentials
        transportSessionAuthenticate(session, object);

      } else {
        // Unexpected, force the session's connection to close
        transportSessionClose(session, object);
      }

    } else {  
      var isSessionCloseMessage = (type === "session") && (action === "close");

      if (isSessionCloseMessage === true) {
        transportSessionClose(session, object);

      } else { // nothing related to the session, we call the callback
        messageReceivedCallback(session, message);
      }
    }
  }

  // Properties
  
  self.sharedSecret = sharedSecret;

  // Methods
  
  /*
   * establishes a socket connection with the url:port server
   */
  self.connect = function(url, port) {

  }

  /*
   * sends a message to a previously established connection
   */
  self.sendMessage = function(session, message) {
    session.sendMessage(message);
  }

  /*
   * makes this node accept connections from another nodes
   * nodeConnectedCallback(session)            - callback that gets called every time a node connects
   * nodeDisconnectedCallback(session)         - callback that gets called every time a node disconnects
   * messageReceivedCallback(session, message) - callback that gets called every time a node sends 
   * a message that is not related with connection
   */
  self.listen = function(nodeConnectedCallback, nodeDisconnectedCallback, messageReceivedCallback) {
    // Server configuration
    var useSSL = false;
    var HTTPHost = '0.0.0.0';
    var port = useSSL ? 443 : 8080;
    var websocketServer;

    if (useSSL) {
      var key = fs.readFileSync('ssl-certificates/localhost_key.pem', 'utf8');
      var certificate = fs.readFileSync('ssl-certificates/localhost_cert.pem', 'utf8');
      var credentials = {
        key: key,
        cert: certificate
      }

      var httpsServer = https.createServer(credentials, express()).listen(port); // Use HTTPS server

      websocketServer = new ws.Server({
        server: httpsServer
      }); // Instantiate the WSS server

    } else {
      websocketServer = new ws.Server({
        host: HTTPHost,
        port: port
      }); // Instantiate the WS server
    }

    websocketServer.on('connection', function connection(websocket) {

      var session = new universalSession.Session(websocket, self.sharedSecret);
      session.didConnect();

      websocket.on('close', function closeEvent(code, data) {
        session.didDisconnect();
        nodeDisconnectedCallback(session);
      });

      websocket.on('error', function errorEvent(error) {
        console.log("websocket error:" + error);
      });

      websocket.on('message', function messageEvent(data, flags) {
        var message = session.unpackMessage(data);
        
        if (util.isNullOrUndefined(message) === false) {                    
          transportSessionDidReceiveMessage(session, message, messageReceivedCallback);
        }
      });

      nodeConnectedCallback(session);
    });

    console.log("*** Coletiv Universal node (Port:" + port + ") ***");
  }
}
