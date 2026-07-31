import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { parseWorkerEnvironment } from '@zorfly/config';
import { processPlatformJob } from './platform/process-platform-job.js';
import { PLATFORM_QUEUE } from './platform/queue-names.js';

const environment = parseWorkerEnvironment();
const logger = pino({
  level: environment.LOG_LEVEL,
  base: { service: 'zorfly-worker' }
});
const connection = new Redis(environment.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});
const worker = new Worker(PLATFORM_QUEUE, processPlatformJob, {
  connection,
  concurrency: 2,
  lockDuration: 30_000
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
});
worker.on('failed', (job, error) => {
  logger.error({ error, jobId: job?.id, jobName: job?.name }, 'Job failed');
});
worker.on('error', (error) => {
  logger.error({ error }, 'Worker error');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'Worker shutting down');
  await worker.close();
  await connection.quit();
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
