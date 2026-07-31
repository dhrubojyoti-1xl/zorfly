import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'production']);
const localSigningKey = 'zorfly-local-signing-key-change-me';
const localHashKey = 'zorfly-local-session-hash-key-change-me';

export const apiEnvironmentSchema = z
  .object({
    NODE_ENV: nodeEnvironment.default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().max(65535).default(5000),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    APP_URL: z.url().default('http://localhost:5173'),
    DATABASE_URL: z
      .url()
      .default('postgresql://zorfly:zorfly-local@localhost:5432/zorfly?schema=public'),
    SESSION_SIGNING_KEY: z.string().min(32).default(localSigningKey),
    SESSION_HASH_KEY: z.string().min(32).default(localHashKey),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
    LOGIN_RATE_LIMIT_WINDOW_MIN: z.coerce.number().int().positive().default(15),
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_FROM: z.string().min(3).default('no-reply@zorfly.local')
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      (environment.SESSION_SIGNING_KEY === localSigningKey ||
        environment.SESSION_HASH_KEY === localHashKey)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Production session keys must be explicitly configured.',
        path: ['SESSION_SIGNING_KEY']
      });
    }
  });

export const workerEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REDIS_URL: z.url().default('redis://localhost:6379')
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function parseApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return apiEnvironmentSchema.parse(source);
}

export function parseWorkerEnvironment(source: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  return workerEnvironmentSchema.parse(source);
}
