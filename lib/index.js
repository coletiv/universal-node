/*

 index.js
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
var apn = require('apn');
var BeApiSession = require('./be-api-session');
var BeApiWebsocket = require('./be-api-websocket');
var BeLogDataStore = require('./be-log-data-store');
var BeDataKafka = require('./be-data-kafka');
var BeDataMongo = require('./be-data-mongo');

// Flag used to disable certain features
var developer_mode = process.env.DEV_MODE || false;

// Flag to enable HTTPS
var useSSL = process.env.USE_SSL || true;

// Server port and credentials
var HTTP_HOST = process.env.HTTP_HOST || '0.0.0.0';
var MONGO_URL = process.env.MONGO_URL || 'localhost';
var MONGO_PORT = process.env.MONGO_PORT || '27017';
var port = useSSL ? 443 : 8080;
var key = fs.readFileSync('ssl-certificates/localhost_key.pem', 'utf8');
var certificate = fs.readFileSync('ssl-certificates/localhost_cert.pem', 'utf8');
var credentials = {
  key: key,
  cert: certificate
};

var certificate = "apn-certificates/Universal-APNS-Development-Certificate.pem";
var key = "apn-certificates/Universal-APNS-Development-Key.pem";

var service = new apn.Connection({
  cert: certificate,
  key: key,
  production: false
});

// Logs

var logs = function(message) {
  console.log(message);
};

// Data

var beLogDataStore = new BeLogDataStore.Store();
var beDataKafka = new BeDataKafka.Client();

if (!developer_mode) {
  BeDataMongo.start("mongodb://" + MONGO_URL + ":" + MONGO_PORT + "/", "mobile", ["raw"], function(err, results) {

    if (err) {
      logs(err);
    }

    if (results) {
      logs(results);
    }
  });
}

var saveRecord = function(data_type, record) {

  // Save on file
  logs(" - Saving File - [ DB." + data_type + ".json ] ");
  beLogDataStore.save(data_type, record);

  // Save on MongoDB
  if (!developer_mode) {
    BeDataMongo.write("raw", record, function(err, results) {

      if (err) {
        return logs(err);
      }

      if (results) {
        logs(results);
        logs(" - Send MongoDB - ");
      }
    });
  }

  // Send to kafka
  if (!developer_mode) {
    beDataKafka.sendMessage(JSON.stringify(record), function(err, results) {

      if (err) {
        logs(err);
      }

      if (results) {
        logs(results);
        logs(" - Send Kafka - ");
      }

    });
  }
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

    //Save Session (logs)
    logs(" - Saving File - [ DB.session.json ] ");
    beLogDataStore.save("session", object);

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

function transportSessionNetworkFound(session, timestamp, ipv4_address, ssid, bssid) {

  // Check & Log public Ip
  ipv4_address = (ipv4_address) ? ipv4_address : session.websocket.remoteAddress();
  logs(" + Public IP: " + ipv4_address);

  // 🚨 IF <record dict change> ALERT Acumulo responsible 🚨
  var record = {
    "ts": timestamp,
    "ipv4": ipv4_address,
    "ssid": ssid,
    "bssid": bssid,
    //"network-id": bssid +"-"+ ssid,
    "user-id": session.userId
  };

  // Save
  saveRecord("network", record);

}

function transportSessionDeviceFound(session, timestamp, mac_address, ip_address_ipv4, ip_address_ipv6, hostname, category, detected_by) {

  // 🚨 IF <record dict change> ALERT Acumulo responsible 🚨
  var record = {
    "ts": timestamp,
    "mac": mac_address,
    "ipv4": ip_address_ipv4,
    "ipv6": ip_address_ipv6,
    "hostname": hostname,
    "category": category,
    "detected_by": detected_by,
    //"network-id": null,
    "user-id": session.userId
  };

  //Save
  saveRecord("devices", record);

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
        transportSessionNetworkFound(session, object.timestamp, object.ipv4_address, object.ssid, object.bssid);
      }
    }

    // Device
    if (type === "device") {
      if (action === "found") {
        transportSessionDeviceFound(session, object.timestamp, object.mac_address, object.ip_address_ipv4, object.ip_address_ipv6, object.hostname, object.category, object.detected_by);
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

// APN

service.on("connected", function() {
  logs("be-api-apn: Connected");
});

service.on("transmitted", function(notification, device) {
  logs("be-api-apn: Notification transmitted to: " + device.token.toString("hex"));
});

service.on("transmissionError", function(errCode, notification, device) {});

service.on("timeout", function() {});

service.on("disconnected", function() {
  logs("be-api-apn: Disconnected");
});

// APN Helper Functions

function apnDeviceWithToken(token) {
  return new apn.Device(token);
}

function apnDevicePushNotification(apnService, device, message) {

  var notification = new apn.Notification();

  notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
  notification.badge = 1;
  notification.sound = "ping.aiff";
  notification.alert = message;
  notification.payload = {
    'message': message
  };

  apnService.pushNotification(notification, device);

}

function apnDeviceFeedback(connection) {
  var options = {
    "batchFeedback": true,
    "interval": 300
  };

  var feedback = new apn.Feedback(options);

  feedback.on("feedback", function(devices) {
    devices.forEach(function(item) {
      // Do something with item.device and item.time;
    });
  });
}

logs("*** BinaryEdge Fortity API Server (Port:" + port + ") ***");
