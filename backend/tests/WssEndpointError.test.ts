import { mkdtempSync, rmSync } from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WSS endpoint creation errors', () => {
  let tempDir: string;
  let server: http.Server | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'endpointlab-wss-error-'));
    process.env.DB_PATH = path.join(tempDir, 'db.sqlite');
    delete process.env.TLS_PRIVATE_KEY;
    delete process.env.TLS_CERTIFICATE;
    delete process.env.TLS_CERTIFICATE_CHAIN;
    vi.resetModules();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close(err => err ? reject(err) : resolve());
      });
      server = undefined;
    }
    delete process.env.DB_PATH;
    vi.resetModules();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the TLS configuration message and rolls back the endpoint', async () => {
    const app = (await import('../src/server')).default;
    server = http.createServer(app);
    await new Promise<void>((resolve, reject) => {
      server?.once('error', reject);
      server?.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not allocate a test port');
    const baseUrl = `http://127.0.0.1:${address.port}/endpointlab/api/endpoints`;

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Secure socket',
        protocol: 'WSS',
        host: 'localhost',
        port: 18443,
        path: '/secure',
        websocketType: 'Server',
        hasResponse: false,
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: 'Cannot create WSS endpoint: TLS_PRIVATE_KEY and TLS_CERTIFICATE are not configured on the server',
    });

    const endpointsResponse = await fetch(baseUrl);
    await expect(endpointsResponse.json()).resolves.toEqual([]);
  });
});
