# BE-API

## Build and Run

To install the dependencies run:

```bash
npm install
```

To run the API server do:

```bash
node be-api-server.js
```

## Dependencies

We are using:

	Node v4.2.6

The main dependencies are:

    "apn"
    "commander"
    "express"
    "kafka-node"
    "msgpack"
    "ws"

## Data Pipe

	—dados mobile—> [nginx 443] —> [Docker 8081 -> [node APi 443]]

	[node Api]:
	- save in multiples files (logs)
	- save on mongoDB
	- send to kafka (accumulo)

![DataPipes](/documents/DataPipes.png)

## MongoDB UI & Server Logs

Connect to the server using this command:

	ssh laugga@api.fortify.binaryedge.io -p 6022 -i <private key> -L 27017:localhost:27017

#### 1 - Check logs

Process running:

	- sudo -s
	- docker logs be-fortify-api

Log Files:

	- cd /opt/be-fortify-api/
	- check:
		- DB.session.json
		- DB.network.json
		- DB.devices.json

Nginx Files:

	- cd /var/log/nginx/
	- check:
		-access.log
		-errors.log

#### 2 - MongoDB UI

	- open "MongoDB compass" app
	- hostname: localhost
	- port: 27017
	- click "connect"

## Docker

	TODO : Write about how to use the docker container

	PORT EXPOSE : 443
