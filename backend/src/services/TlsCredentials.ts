import type { ServerOptions } from 'https';

export interface TlsCredentialValues {
  privateKey?: string;
  certificate?: string;
  certificateChain?: string;
}

export class TlsConfigurationError extends Error {}

export function loadTlsCredentials(values: TlsCredentialValues): ServerOptions {
  if (!values.privateKey || !values.certificate) {
    throw new TlsConfigurationError(
      'Cannot create WSS endpoint: TLS_PRIVATE_KEY and TLS_CERTIFICATE are not configured on the server',
    );
  }

  const key = normalizePem(values.privateKey);
  const certificate = normalizePem(values.certificate);
  const certificateChain = values.certificateChain
    ? normalizePem(values.certificateChain)
    : null;
  const cert = certificateChain
    ? `${certificate.trimEnd()}\n${certificateChain}`
    : certificate;

  return { key, cert };
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n');
}
