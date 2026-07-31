import type { Job } from 'bullmq';
import { PLATFORM_HEALTH_JOB } from './queue-names.js';

export interface PlatformHealthResult {
  checkedAt: string;
  status: 'ok';
}

export function processPlatformJob(job: Job): Promise<PlatformHealthResult> {
  if (job.name !== PLATFORM_HEALTH_JOB) {
    return Promise.reject(new Error(`Unsupported platform job: ${job.name}`));
  }

  return Promise.resolve({
    checkedAt: new Date().toISOString(),
    status: 'ok'
  });
}
