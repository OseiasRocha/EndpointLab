import path from 'path';
import fs from 'fs';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import logger from 'jet-logger';
import morgan from 'morgan';

import Paths from './common/constants/Paths';
import { RouteError } from './common/utils/route-errors';
import BaseRouter from './routes/apiRouter';

import EnvVars, { NodeEnvs } from './common/constants/env';

/******************************************************************************
                                Setup
******************************************************************************/

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (EnvVars.NodeEnv === NodeEnvs.DEV) {
  app.use(morgan('dev'));
}

if (EnvVars.NodeEnv === NodeEnvs.PRODUCTION) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
      },
    },
  }));
}

app.use(Paths._, BaseRouter);
app.use(Paths._, (_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

if (EnvVars.NodeEnv === NodeEnvs.PRODUCTION) {
  const publicDirCandidates = [path.join(__dirname, 'public'), path.resolve(__dirname, '../../public')];
  const publicDir = publicDirCandidates.find((dir) => fs.existsSync(dir)) ?? publicDirCandidates[0];
  app.use(express.static(publicDir));
  app.get('*path', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

app.use((err: Error, _: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (EnvVars.NodeEnv !== NodeEnvs.TEST.valueOf()) {
    logger.err(err, true);
  }

  if (err instanceof RouteError) {
    return res.status(err.status).json({ message: err.message });
  }

  return res.status(500).json({ message: 'Internal server error' });
});

/******************************************************************************
                                Export default
******************************************************************************/

export default app;
