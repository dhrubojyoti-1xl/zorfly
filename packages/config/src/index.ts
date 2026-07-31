import { z } from 'zod';

const nodeEnvironment = z.enum(['development', 'test', 'production']);

export const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironment.default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(5000),
  WEB_ORIGIN: z.url().default('http://localhost:5173')
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
