/* eslint-disable no-process-env */
import fs from 'fs';
import http, { IncomingMessage } from 'http';
import https from 'https';
import path from 'path';
import WebSocket from 'ws';

import logger from 'jet-logger';

import EnvVars from './common/constants/env';
import app from './server';
import WsManager from './services/WebSocketManager';
import EndpointRepo from './repos/EndpointRepo';
import { Duplex } from 'stream';

/******************************************************************************
                                  Run
******************************************************************************/

let activeHttpsPort: number | null = null;

const httpServer = http.createServer((req, res) => {
  app(req, res);
});
httpServer.listen(EnvVars.Port, () => {
  logger.info('Express server started on HTTP port: ' + EnvVars.Port);
  WsManager.initialize(EndpointRepo.getAll());
});
httpServer.on('error', (err: Error) => logger.err(err.message));