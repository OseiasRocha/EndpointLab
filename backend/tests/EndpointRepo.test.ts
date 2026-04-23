/* eslint-disable no-process-env */
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type EndpointRepoType from '../src/repos/EndpointRepo';

describe('EndpointRepo.bulkUpsert', () => {
  let tempDir: string;
  let repo: typeof EndpointRepoType;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'endpointlab-'));
    process.env.DB_PATH = path.join(tempDir, 'db.sqlite');
    vi.resetModules();
    repo = (await import('../src/repos/EndpointRepo')).default;
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    vi.resetModules();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a new endpoint when an old import matches name/host/port but not the full target', () => {
    repo.add({
      externalId: undefined,
      name: 'Orders',
      protocol: 'HTTP',
      host: 'localhost',
      port: 8080,
      httpMethod: 'GET',
      path: '/orders',
      requestBody: undefined,
      hasResponse: false,
      responseBody: undefined,
      description: undefined,
      group: undefined,
    });

    const result = repo.bulkUpsert([{
      externalId: undefined,
      name: 'Orders',
      protocol: 'HTTP',
      host: 'localhost',
      port: 8080,
      httpMethod: 'GET',
      path: '/orders/archived',
      requestBody: undefined,
      hasResponse: false,
      responseBody: undefined,
      description: undefined,
      group: undefined,
    }]);

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(repo.getAll()).toHaveLength(2);
  });

  it('updates by externalId even when the endpoint name and target change', () => {
    const created = repo.add({
      externalId: undefined,
      name: 'Original endpoint',
      protocol: 'HTTP',
      host: 'localhost',
      port: 8080,
      httpMethod: 'GET',
      path: '/health',
      requestBody: undefined,
      hasResponse: false,
      responseBody: undefined,
      description: undefined,
      group: undefined,
    });

    const result = repo.bulkUpsert([{
      externalId: created.externalId,
      name: 'Renamed endpoint',
      protocol: 'UDP',
      host: '127.0.0.1',
      port: 18082,
      httpMethod: undefined,
      path: undefined,
      requestBody: 'ping',
      hasResponse: true,
      responseBody: 'pong',
      description: 'updated',
      group: 'local',
    }]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0]?.id).toBe(created.id);
    expect(result.updated[0]?.name).toBe('Renamed endpoint');
    expect(result.updated[0]?.protocol).toBe('UDP');
    expect(repo.getAll()).toHaveLength(1);
  });
});
