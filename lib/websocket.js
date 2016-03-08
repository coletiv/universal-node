/*

 websocket.js
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

var msgpack = require('msgpack');

exports.Websocket = function(websocket) {
  var self = this;

  self.websocket = websocket;

  // Actions

  self.unpackMessage = function(data) {

    if (!(data instanceof Buffer)) {
      console.log('Websocket.unpackMessage: Invalid data type');
      return undefined;
    }

    return msgpack.unpack(data);
  };

  self.packMessage = function(message) {
    return msgpack.pack(message);
  };

  self.sendMessage = function(message) {
    var data = self.packMessage(message);
    
    self.websocket.send(data, {
      binary: true,
      mask: true
    });
  };

  self.close = function() {
    self.websocket.close();
  };
};
