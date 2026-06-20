import dgram from 'dgram';
import http from 'http';
import https from 'https';
import net from 'net';
import WebSocket from 'ws';

import type { IEndpoint, TransmitResult } from '../../../shared/src';
import WsManager from './WebSocketManager';

/******************************************************************************
                                Websockets
******************************************************************************/

/******************************************************************************
                                Constants
******************************************************************************/

const TIMEOUT_MS = 5000;

/******************************************************************************
                                Functions
******************************************************************************/

function transmitWeb(
  endpoint: IEndpoint,
  client: typeof http | typeof https,
  redirectsLeft = 10,
): Promise<TransmitResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const body = endpoint.requestBody ?? '';
    const req = client.request(
      {
        hostname: endpoint.host,
        port: endpoint.port,
        path: endpoint.path ?? '/',
        method: endpoint.httpMethod ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;

        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirectsLeft === 0) {
            return resolve({ success: false, error: 'Too many redirects', latencyMs: Date.now() - start });
          }
          const url = new URL(location, `${client === https ? 'https' : 'http'}://${endpoint.host}:${endpoint.port}`);
          const nextClient = url.protocol === 'https:' ? https : http;
          const nextEndpoint: IEndpoint = {
            ...endpoint,
            host: url.hostname,
            port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
          };
          void transmitWeb(nextEndpoint, nextClient, redirectsLeft - 1)
            .then(result => resolve({ ...result, latencyMs: Date.now() - start }));
          return;
        }

        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          const ok = status >= 200 && status < 300;
          resolve({
            success: ok,
            statusCode: status || undefined,
            responseBody: endpoint.hasResponse ? data : undefined,
            latencyMs: Date.now() - start,
          });
        });
      },
    );

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timed out', latencyMs: Date.now() - start });
    });

    req.on('error', (err: NodeJS.ErrnoException) =>
      resolve({ success: false, error: err.message || err.code || 'Connection failed', latencyMs: Date.now() - start }),
    );

    if (body) req.write(body);
    req.end();
  });
}

function transmitTcp(endpoint: IEndpoint): Promise<TransmitResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    let response = '';

    socket.setTimeout(TIMEOUT_MS);

    socket.on('connect', () => {
      if (endpoint.requestBody) socket.write(endpoint.requestBody);
      if (!endpoint.hasResponse) {
        socket.end();
        resolve({ success: true, latencyMs: Date.now() - start });
      }
    });

    socket.on('data', (chunk: Buffer) => (response += chunk.toString()));

    socket.on('end', () =>
      resolve({
        success: true,
        responseBody: endpoint.hasResponse ? response : undefined,
        latencyMs: Date.now() - start,
      }),
    );

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        success: false,
        responseBody: response || undefined,
        error: 'Connection timed out waiting for response',
        latencyMs: Date.now() - start,
      });
    });

    socket.on('error', (err: Error) =>
      resolve({ success: false, error: err.message, latencyMs: Date.now() - start }),
    );
  });
}

function transmitUdp(endpoint: IEndpoint): Promise<TransmitResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from(endpoint.requestBody ?? '');

    if (endpoint.hasResponse) {
      const timer = setTimeout(() => {
        client.close();
        resolve({ success: false, error: 'Timed out waiting for UDP response', latencyMs: Date.now() - start });
      }, TIMEOUT_MS);

      client.on('message', (msg) => {
        clearTimeout(timer);
        client.close();
        resolve({ success: true, responseBody: msg.toString(), latencyMs: Date.now() - start });
      });
    }

    client.send(message, endpoint.port, endpoint.host, (err) => {
      if (err) {
        client.close();
        return resolve({ success: false, error: err.message, latencyMs: Date.now() - start });
      }
      if (!endpoint.hasResponse) {
        client.close();
        resolve({ success: true, latencyMs: Date.now() - start });
      }
    });

    client.on('error', (err: Error) => {
      client.close();
      resolve({ success: false, error: err.message, latencyMs: Date.now() - start });
    });
  });
}

function transmitWebSocket(endpoint: IEndpoint): Promise<TransmitResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const ws = WsManager.getClientSocket(endpoint);
    if (!ws) {
      return resolve({ success: false, error: 'WebSocket not connected', latencyMs: Date.now() - start });
    }

    if (endpoint.requestBody) ws.send(endpoint.requestBody);

    if (!endpoint.hasResponse) {
      return resolve({ success: true, latencyMs: Date.now() - start });
    }

    let settled = false;

    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      settle({ success: false, error: 'Request timed out', latencyMs: Date.now() - start });
    }, TIMEOUT_MS);

    function settle(result: TransmitResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    function onMessage(data: WebSocket.RawData) {
      settle({ success: true, responseBody: (data as Buffer).toString(), latencyMs: Date.now() - start });
    }

    ws.once('message', onMessage);
  });
}

function serveWebSocket(endpoint: IEndpoint): Promise<TransmitResult> {
  const start = Date.now();
  const recipients = WsManager.broadcast(endpoint);
  if (recipients === 0) {
    return Promise.resolve({
      success: false,
      error: 'No WebSocket clients connected',
      latencyMs: Date.now() - start,
    });
  }
  return Promise.resolve({ success: true, latencyMs: Date.now() - start });
}

function handleWebSocket(endpoint: IEndpoint): Promise<TransmitResult> {
  switch (endpoint.websocketType) {
    case "Client":
      return transmitWebSocket(endpoint);
    case "Server":
      return serveWebSocket(endpoint);
  }
  return new Promise(() => {
    return { success: false, error: 'Invalid WS type' };
  });
}

function transmit(endpoint: IEndpoint): Promise<TransmitResult> {
  switch (endpoint.protocol) {
    case 'HTTP': return transmitWeb(endpoint, http);
    case 'HTTPS': return transmitWeb(endpoint, https);
    case 'TCP': return transmitTcp(endpoint);
    case 'UDP': return transmitUdp(endpoint);
    case 'WS':
    case 'WSS': return handleWebSocket(endpoint);
    default: throw new Error('Unsupported protocol');
  }
}

/******************************************************************************
                                Export default
******************************************************************************/

export default { transmit } as const;
