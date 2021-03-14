
require('dotenv').config();
const { createPublicKey } = require('node:crypto');
const WebSocket = require('ws');

const WS_SERVER_PORT = process.env.WS_SERVER_PORT || 8081;

const wsServer = new WebSocket.Server({
    port: WS_SERVER_PORT,
});

const clientsByChannel = new Map;

wsServer.on('connection', (client, req) => {
    client.isAlive = true;
    client.on('pong', () => {
        client.isAlive = true;
    });

    const channel = new URL(req.url, `http://${req.headers.host}`).pathname.split('/').slice(-1)[0];
    if (!clientsByChannel.has(channel)) {
        clientsByChannel.set(channel, new Set);
    }

    client.channelName = channel;
    clientsByChannel.get(channel).add(client);

    client.on('message', data => {
        for (const receiver of (clientsByChannel.get(channel) || [])) {
            if (receiver == client) continue;
            try {
                receiver.send(data);
            } catch (e) {
                console.warn(e);
            }
        }
    });

    client.on('close', () => {
        if (clientsByChannel.has(client.channelName)) {
            clientsByChannel.get(client.channelName).delete(client);
            if (clientsByChannel.get(client.channelName).size < 1) {
                clientsByChannel.delete(client.channelName);
            }
        }
    });
});

setInterval(() => {
    for (const client of wsServer.clients) {
        if (!client.isAlive) {
            client.terminate();
            if (clientsByChannel.has(client.channelName)) {
                clientsByChannel.get(client.channelName).delete(client);
                if (clientsByChannel.get(client.channelName).size < 1) {
                    clientsByChannel.delete(client.channelName);
                }
            }
            continue;
        }
        client.isAlive = false;
        client.ping('');
    }
}, 30000);
