import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { ApiEnvironment } from '@zorfly/config';
import type { ZorflyPrismaClient } from '@zorfly/database';
import { createAuthRouter } from './modules/auth/auth.router.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { TokenService } from './modules/auth/tokens.js';
import { createHealthRouter } from './modules/health/health.router.js';
import {
  createCompanyRouter,
  createRoleRouter
} from './modules/organization/organization.router.js';
import {
  createBranchRouter,
  createDepartmentRouter,
  createTeamRouter
} from './modules/organization/org-units.router.js';
import { createEmployeeRouter } from './modules/organization/employees.router.js';
import { createLogger } from './platform/logger.js';
import { notFoundHandler, problemHandler } from './platform/problem.js';
import { createCategoryRouter } from './modules/assessment/categories.router.js';
import { createQuestionRouter } from './modules/assessment/questions.router.js';
import { createTestRouter } from './modules/assessment/tests.router.js';
import { createAttemptRouter } from './modules/assessment/attempts.router.js';
import { createAiRouter } from './modules/ai/ai.router.js';
import type { AiExecutionService } from './modules/ai/ai.service.js';

export interface AppOptions {
  environment: ApiEnvironment;
  version: string;
  auth?: {
    service: AuthService;
    tokens: TokenService;
  };
  organization?: {
    prisma: ZorflyPrismaClient;
  };
  ai?: {
    service: AiExecutionService;
  };
}

export function createApp({ environment, version, auth, organization, ai }: AppOptions): Express {
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
    if (organization) {
      app.use(
        '/api/v1/companies',
        createCompanyRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use('/api/v1/roles', createRoleRouter(organization.prisma, auth.service, auth.tokens));
      app.use(
        '/api/v1/departments',
        createDepartmentRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use(
        '/api/v1/branches',
        createBranchRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use('/api/v1/teams', createTeamRouter(organization.prisma, auth.service, auth.tokens));
      app.use(
        '/api/v1/employees',
        createEmployeeRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use(
        '/api/v1/categories',
        createCategoryRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use(
        '/api/v1/questions',
        createQuestionRouter(organization.prisma, auth.service, auth.tokens)
      );
      app.use('/api/v1/tests', createTestRouter(organization.prisma, auth.service, auth.tokens));
      app.use(
        '/api/v1/attempts',
        createAttemptRouter(organization.prisma, auth.service, auth.tokens)
      );
      if (ai) {
        app.use(
          '/api/v1/ai',
          createAiRouter(organization.prisma, auth.service, auth.tokens, ai.service)
        );
      }
    }
  }
  app.use(notFoundHandler);
  app.use(problemHandler);

  return app;
}
