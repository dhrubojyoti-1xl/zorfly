import { parseApiEnvironment } from '@zorfly/config';
import { createPrismaClient } from '@zorfly/database';
import { createApp } from './app.js';
import { AuthService } from './modules/auth/auth.service.js';
import { passwordHasher } from './modules/auth/password.js';
import { PrismaAuthRepository } from './modules/auth/prisma-auth.repository.js';
import { SmtpAuthMailer } from './modules/auth/smtp-auth.mailer.js';
import { createTokenService } from './modules/auth/tokens.js';

const environment = parseApiEnvironment();
const prisma = createPrismaClient(environment.DATABASE_URL);
const tokens = createTokenService({
  signingKey: environment.SESSION_SIGNING_KEY,
  hashKey: environment.SESSION_HASH_KEY,
  accessTokenTtlSeconds: environment.ACCESS_TOKEN_TTL_SECONDS
});
const authService = new AuthService({
  repository: new PrismaAuthRepository(prisma, environment.SESSION_HASH_KEY),
  passwordHasher,
  tokens,
  mailer: new SmtpAuthMailer(environment),
  refreshTokenTtlSeconds: environment.REFRESH_TOKEN_TTL_SECONDS,
  appUrl: environment.APP_URL
});
const app = createApp({
  environment,
  version: '0.1.0',
  auth: { service: authService, tokens }
});

const server = app.listen(environment.API_PORT, environment.API_HOST, () => {
  process.stdout.write(
    `Zorfly API listening at http://${environment.API_HOST}:${String(environment.API_PORT)}\n`
  );
});

function shutdown(signal: NodeJS.Signals): void {
  server.close((error) => {
    if (error) {
      process.stderr.write(`API shutdown after ${signal} failed: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    void prisma.$disconnect().then(() => {
      process.exitCode = 0;
    });
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
