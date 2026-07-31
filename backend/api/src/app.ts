import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { ApiEnvironment } from '@zorfly/config';
import { createHealthRouter } from './modules/health/health.router.js';
import { createLogger } from './platform/logger.js';
import { notFoundHandler, problemHandler } from './platform/problem.js';

export interface AppOptions {
  environment: ApiEnvironment;
  version: string;
}

export function createApp({ environment, version }: AppOptions): Express {
  const app = express();
  const logger = createLogger(environment.LOG_LEVEL);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    pinoHttp({
      logger,
      genReqId(request, response) {
        const incoming = request.headers['x-request-id'];
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      }
    })
  );
  app.use(helmet());
  app.use(
    cors({
      origin: environment.WEB_ORIGIN,
      credentials: true,
      allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id'],
      exposedHeaders: ['x-request-id']
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1/health', createHealthRouter(version));
  app.use(notFoundHandler);
  app.use(problemHandler);

  return app;
}
