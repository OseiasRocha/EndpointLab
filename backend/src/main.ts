/* eslint-disable no-process-env */
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import logger from 'jet-logger';

import EnvVars from './common/constants/env';
import app from './server';

/******************************************************************************
                                  Run
******************************************************************************/

const httpServer = http.createServer(app);
httpServer.listen(EnvVars.Port, () => {
  logger.info('Express server started on HTTP port: ' + EnvVars.Port);
});
httpServer.on('error', (err: Error) => logger.err(err.message));

const httpsPort = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT) : null;
const certDir = process.env.CERT_DIR ?? '';

if (httpsPort && certDir) {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  const fullChainPath = path.join(certDir, 'fullchain.pem');
  const chainPath = path.join(certDir, 'chain.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const cert = fs.existsSync(fullChainPath)
      ? fs.readFileSync(fullChainPath)
      : readCertificateChain(certPath, chainPath);

    const httpsServer = https.createServer(
      { key: fs.readFileSync(keyPath), cert },
      app,
    );
    httpsServer.listen(httpsPort, () => {
      logger.info('Express server started on HTTPS port: ' + httpsPort);
    });
    httpsServer.on('error', (err: Error) => logger.err(err.message));
  } else {
    logger.warn('TLS cert files not found in CERT_DIR, skipping HTTPS');
  }
}

function readCertificateChain(certPath: string, chainPath: string): Buffer {
  const leafCert = fs.readFileSync(certPath);

  if (!fs.existsSync(chainPath)) {
    return leafCert;
  }

  return Buffer.concat([
    leafCert,
    Buffer.from('\n'),
    fs.readFileSync(chainPath),
  ]);
}
