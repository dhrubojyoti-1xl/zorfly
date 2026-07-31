import { describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import { processPlatformJob } from '../src/platform/process-platform-job.js';
import { PLATFORM_HEALTH_JOB } from '../src/platform/queue-names.js';

describe('processPlatformJob', () => {
  it('handles the platform health job', async () => {
    await expect(processPlatformJob({ name: PLATFORM_HEALTH_JOB } as Job)).resolves.toMatchObject({
      status: 'ok'
    });
  });

  it('rejects unregistered job names', async () => {
    await expect(processPlatformJob({ name: 'unknown' } as Job)).rejects.toThrow(
      'Unsupported platform job'
    );
  });
});
