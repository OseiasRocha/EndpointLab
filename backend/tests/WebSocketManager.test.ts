import net from 'net';

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import type { IEndpoint } from '../../shared/src';
import { WebSocketManager } from '../src/services/WebSocketManager';

function endpoint(id: number, port: number, path = '/socket'): IEndpoint {
  return {
    id,
    externalId: `endpoint-${id}`,
    name: `Socket ${id}`,
    protocol: 'WS',
    host: 'localhost',
    port,
    httpMethod: undefined,
    path,
    requestBody: undefined,
    websocketType: 'Server',
    hasResponse: false,
    responseBody: undefined,
    description: undefined,
    group: undefined,
    order: id,
  };
}

function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a test port'));
        return;
      }
      server.close(err => err ? reject(err) : resolve(address.port));
    });
  });
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function closed(ws: WebSocket): Promise<void> {
  return new Promise(resolve => ws.once('close', () => resolve()));
}

describe('WebSocketManager server lifecycle', () => {
  const managers: Array<{ manager: WebSocketManager; endpoint: IEndpoint }> = [];

  afterEach(async () => {
    for (const item of managers.splice(0)) await item.manager.untrack(item.endpoint);
  });

  it('disconnects clients and releases the port before recreating an edited endpoint', async () => {
    const port = await unusedPort();
    const manager = new WebSocketManager();
    const original = endpoint(1, port);
    managers.push({ manager, endpoint: original });

    await manager.track(original);
    const client = await connect(`ws://127.0.0.1:${port}${original.path}`);
    const clientClosed = closed(client);

    await manager.untrack(original);
    await clientClosed;

    const edited = endpoint(1, port, '/edited');
    managers[0].endpoint = edited;
    await manager.track(edited);
    const replacementClient = await connect(`ws://127.0.0.1:${port}${edited.path}`);

    expect(client.readyState).toBe(WebSocket.CLOSED);
    expect(replacementClient.readyState).toBe(WebSocket.OPEN);
    replacementClient.terminate();
  });

  it('releases a server port even when no client ever connected', async () => {
    const port = await unusedPort();
    const manager = new WebSocketManager();
    const original = endpoint(1, port);
    managers.push({ manager, endpoint: original });

    await manager.track(original);
    await manager.untrack(original);

    const edited = endpoint(1, port, '/edited');
    managers[0].endpoint = edited;
    await expect(manager.track(edited)).resolves.toBeUndefined();
  });
});
