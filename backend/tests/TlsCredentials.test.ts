import { describe, expect, it } from 'vitest';

import { loadTlsCredentials } from '../src/services/TlsCredentials';

describe('loadTlsCredentials', () => {
  it('requires the private key and certificate environment values', () => {
    expect(() => loadTlsCredentials({})).toThrow(
      'Cannot create WSS endpoint: TLS_PRIVATE_KEY and TLS_CERTIFICATE are not configured on the server',
    );
  });

  it('uses PEM content directly from environment values', () => {
    const credentials = loadTlsCredentials({
      privateKey: 'private-key',
      certificate: 'leaf-certificate',
    });

    expect(credentials.key).toBe('private-key');
    expect(credentials.cert).toBe('leaf-certificate');
  });

  it('normalizes escaped newlines and appends the optional chain', () => {
    const credentials = loadTlsCredentials({
      privateKey: 'private\\nkey',
      certificate: 'leaf\\ncertificate',
      certificateChain: 'certificate\\nchain',
    });

    expect(credentials.key).toBe('private\nkey');
    expect(credentials.cert).toBe('leaf\ncertificate\ncertificate\nchain');
  });
});
