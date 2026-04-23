import dgram from 'dgram';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

import type { IEndpoint, TransmitResult } from '../../../shared/src';

/******************************************************************************
                                Constants
******************************************************************************/

const TIMEOUT_MS = 5000;
const HTTPS_CA_CERTIFICATES = Array.from(
  new Set([
    ...tls.getCACertificates('bundled'),
    ...tls.getCACertificates('system'),
    ...tls.getCACertificates('extra'),
  ]),
);

/******************************************************************************
                                Functions
******************************************************************************/

function transmitWeb(
  endpoint: IEndpoint,
  client: typeof http | typeof https,
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
        ...(client === https ? { ca: HTTPS_CA_CERTIFICATES } : {}),
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          resolve({
            success: (res.statusCode ?? 0) < 400,
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

    req.on('error', (err: Error) =>
      resolve({ success: false, error: err.message, latencyMs: Date.now() - start }),
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

function transmit(endpoint: IEndpoint): Promise<TransmitResult> {
  switch (endpoint.protocol) {
    case 'HTTP': return transmitWeb(endpoint, http);
    case 'HTTPS': return transmitWeb(endpoint, https);
    case 'TCP': return transmitTcp(endpoint);
    case 'UDP': return transmitUdp(endpoint);
    default: throw new Error('Unsupported protocol');
  }
}

/******************************************************************************
                                Export default
******************************************************************************/

export default { transmit } as const;
