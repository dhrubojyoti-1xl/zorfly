import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { ApiEnvironment } from '@zorfly/config';
import { createAuthRouter } from './modules/auth/auth.router.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { TokenService } from './modules/auth/tokens.js';
import { createHealthRouter } from './modules/health/health.router.js';
import { createLogger } from './platform/logger.js';
import { notFoundHandler, problemHandler } from './platform/problem.js';

export interface AppOptions {
  environment: ApiEnvironment;
  version: string;
  auth?: {
    service: AuthService;
    tokens: TokenService;
  };
}

export function createApp({ environment, version, auth }: AppOptions): Express {
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
  app.use(cookieParser());

  app.use('/api/v1/health', createHealthRouter(version));
  if (auth) {
    app.use('/api/v1/auth', createAuthRouter(auth.service, auth.tokens, environment));
  }
  app.use(notFoundHandler);
  app.use(problemHandler);

  return app;
}
