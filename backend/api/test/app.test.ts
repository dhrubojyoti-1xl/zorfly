import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { parseApiEnvironment } from '@zorfly/config';
import { healthResponseSchema } from '@zorfly/contracts';
import { createApp } from '../src/app.js';

const app = createApp({
  environment: parseApiEnvironment({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
  version: 'test'
});

describe('API foundation', () => {
  it('returns the versioned health contract and request identifier', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    const parsed = healthResponseSchema.parse(response.body);

    expect(parsed.data).toEqual({
      service: 'zorfly-api',
      status: 'ok',
      version: 'test'
    });
    expect(response.headers['x-request-id']).toBe(parsed.meta.requestId);
  });

  it('returns RFC 9457-compatible problem details for unknown routes', async () => {
    const response = await request(app).get('/api/v1/missing').expect(404);

    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/api/v1/missing'
    });
  });
});
