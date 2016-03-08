/*
 
 session.js
 Universal-node
 
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

var universalWebsocketModule = require('./websocket');

exports.Session = function(websocket, sharedSecret) {

  var self = this;

  // possible connection states 
  var connectedState = 'connected';
  var authenticatedState = 'authenticated';
  var idleState = 'idle';

  self.token = undefined;
  self.state = idleState; // Connection state {idle, connected, authenticated}
  self.userId = undefined; // User UUID
  self.sharedSecret = sharedSecret;

  self.websocket = new universalWebsocketModule.Websocket(websocket);

  // Events

  self.didConnect = function() {
    self.state = connectedState;
  };

  self.isConnected = function() {
    return self.state === connectedState;
  }

  self.didDisconnect = function() {
    self.websocket = undefined;
    self.state = idleState;
  };

  self.didClose = function() {
    self.deviceIdentifier = undefined;

    if (self.websocket !== undefined) {
      self.websocket.close();
    }
  };

  self.didAuthenticateWithUserId = function(userId, token) {
    self.userId = userId;
    self.token = token;
    self.state = authenticatedState;    
  };

  self.isAuthenticated = function() {
    return self.state === authenticatedState;
  };

  self.sendMessage = function(message) {    

    if (self.websocket !== undefined) {      
      self.websocket.sendMessage(message);
    }
  };

  /*
   *  just a proxy to the websocket unpack message
   */
  self.unpackMessage = function(data) {
    return self.websocket.unpackMessage(data);
  }

};
