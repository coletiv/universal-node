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

var universalNodeModule = require("universal-node");
var fileSystemModule    = require('fs');

function nodeDidConnect(session) {
	console.log('a node just connected: ' + session);
};

function nodeDidDisconnect(session) {
	console.log('a node disconnected: ' + session);
};

function didReceiveMessageFromNode(session, message) {
	console.log('a node sent a message: \'' + message + '\'');
	console.log('sending echo back');

	session.sendMessage(message); // just echo whatever the node sent to us
};

var SHARED_SECRET = '1728361872638323727987987ab123123';
var node = new universalNodeModule.UniversalNode();

var key = fileSystemModule.readFileSync('ssl-certificates/key.pem', 'utf8');
var certificate = fileSystemModule.readFileSync('ssl-certificates/cert.pem', 'utf8');

node.listen(SHARED_SECRET, nodeDidConnect, nodeDidDisconnect, didReceiveMessageFromNode, true, key, certificate);
