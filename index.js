
require('dotenv').config();
const WebSocket = require('ws');

const WS_SERVER_PORT = process.env.WS_SERVER_PORT || 8081;

const wsServer = new WebSocket.Server({
    port: WS_SERVER_PORT,
});

wsServer.on('connection', client => {
    client.isAlive = true;
    client.on('pong', () => {
        client.isAlive = true;
    });

    client.on('message', data => {
        for (const receiver of wsServer.clients) {
            if (receiver == client) continue;
            try {
                receiver.send(data);
            } catch (e) {
                console.warn(e);
            }
        }
    })
});

setInterval(() => {
    for (const client of wsServer.clients) {
        if (!client.isAlive) {
            client.terminate();
            continue;
        }
        client.isAlive = false;
        client.ping({});
    }
}, 30000);
