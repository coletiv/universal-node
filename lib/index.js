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

var util              = require('util');
var https             = require('https');
var express           = require('express');
var ws                = require('ws');
var universalSession  = require('./session');

exports.UniversalNode = function() {
  var self = this;

  // Public Methods
  
  /*
   * establishes a socket connection with the url:port server
   * nodeConnectedCallback(session)                - callback that gets called when the node connects
   * nodeDisconnectedCallback(session)             - callback that gets called when the node disconnects
   * nodeReceivedMessageCallback(session, message) - callback that gets called every time the node receives a message
   */
  self.connect = function(url, port, sharedSecret, userID, nodeConnectedCallback, nodeDisconnectedCallback, nodeReceivedMessageCallback) {
    var fullURL = url + ':' + port;
    var websocket = new ws(fullURL);
    
    var session = new universalSession.Session(websocket, sharedSecret);  
    session.userId = userID;

    websocket.on('open', function open() {    
      
      // the authentication is opaque for the user
      var authenticationPayload = {
        'shared_secret':  session.sharedSecret, 
        'user_id':        session.userId
      };

      session.didConnect();
      session.sendMessage(['session', 'authenticate', authenticationPayload]);      
    });

    websocket.on('close', function close() {
      session.didClose();
      nodeDisconnectedCallback(session);
    });

    websocket.on('message', function message(data, flags) {  
      var message = session.unpackMessage(data);
      var type   = message[0];
      var action = message[1];
      var object = message[2];

      // we don't want that the users see session related messages, they should not care
      var isSessionAuthenticatedMessage = (type === 'session') && (action == 'authenticated');

      if (isSessionAuthenticatedMessage) { 
        var token = undefined;

        if (object.token) {
          token = object.token;
        }

        session.didAuthenticateWithUserId(userID, token);

        nodeConnectedCallback(session);  

      } else {
        nodeReceivedMessageCallback(session, message);
      }
    });
  }

  /*
   * makes this node accept connections from another nodes
   * nodeConnectedCallback(session)                - callback that gets called every time a node connects & authenticates
   * nodeDisconnectedCallback(session)             - callback that gets called every time a node disconnects
   * nodeReceivedMessageCallback(session, message) - callback that gets called every time a node sends 
   * a message that is not related with connection
   */
  self.listen = function(sharedSecret, nodeConnectedCallback, nodeDisconnectedCallback, nodeReceivedMessageCallback, useSSL, key, certificate) {
    // Server configuration
    var port = useSSL ? 443 : 8080;
    var websocketServer;

    if (useSSL === true) {
      
      if ( (key === undefined) || (certificate === undefined) ) {
        console.error('when enabling ssl a valid key and certificate must be provided');
        process.exit(1);
      }

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
        port: port
      }); // Instantiate the WS server
    }

    websocketServer.on('connection', function connection(websocket) {

      var session = new universalSession.Session(websocket, sharedSecret);
      session.didConnect();

      websocket.on('close', function closeEvent(code, data) {
        session.didDisconnect();
        nodeDisconnectedCallback(session);
      });

      websocket.on('error', function errorEvent(error) {
        console.error('websocket error:' + error);
      });

      websocket.on('message', function messageEvent(data, flags) {
        var message = session.unpackMessage(data);
        
        if (util.isNullOrUndefined(message) === false) {                    
          sessionDidReceiveMessage(session, message, nodeReceivedMessageCallback, nodeConnectedCallback);
        }
      });      
    });


    // Session (Actions and Events)
  
    function sessionAuthenticate(session, object, nodeConnectedCallback) {
      console.log("sessionAuthenticate");

      if (session.isConnected() && (object.shared_secret === session.sharedSecret) ) {
        console.log("sessionAuthenticate 'Success'");

        var token = undefined;

        if (object.token) {
          token = object.token;
        }

        session.didAuthenticateWithUserId(object.user_id, token);   
        nodeConnectedCallback(session);  // the connected callback only gets called when the user actually authenticated   

        session.sendMessage(["session", "authenticated", {
          "user_id": session.userId,
          "shared_secret": session.sharedSecret
        }]);    

      } else {
        console.error("sessionAuthenticate 'Failed'");
        sessionClose(session, object);
      }
    }

    function sessionClose(session, object) {
      console.log("sessionClose");

      session.didClose();  
    }

    function sessionDidReceiveMessage(session, message, nodeReceivedMessageCallback, nodeConnectedCallback) {    
      var type   = message[0];
      var action = message[1];
      var object = message[2];

      // Check if the session is 'authenticated'
      if (session.isAuthenticated() === false) {    

        var isSessionAuthenticateMessage = (type === "session") && (action === "authenticate");

        // Expected 'session' 'authenticate'
        if (isSessionAuthenticateMessage === true) {
          // Check credentials
          sessionAuthenticate(session, object, nodeConnectedCallback);

        } else {
          /*
           * Unexpected, whyle not authenticated we just ignore any message that is not "session authenticate"           
           */    
          console.error('received message while not authenticated: ' + message);

          return;
        }

      } else {  
        var isSessionCloseMessage = (type === "session") && (action === "close");

        if (isSessionCloseMessage === true) {
          sessionClose(session, object);

        } else { // nothing related to the session, we call the callback
          nodeReceivedMessageCallback(session, message);
        }
      }
    }  
      console.log('*** Coletiv Universal node (Port:' + port + ') ***');
    }  
}
