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

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsServer = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
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
