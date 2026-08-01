import { describe, expect, it } from 'vitest';
import { parseApiEnvironment, parseWorkerEnvironment } from '../src/index.js';

describe('environment parsing', () => {
  it('applies safe local API defaults', () => {
    expect(parseApiEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      API_HOST: '0.0.0.0',
      API_PORT: 5000
    });
  });

  it('rejects invalid worker Redis URLs', () => {
    expect(() => parseWorkerEnvironment({ REDIS_URL: 'not-a-url' })).toThrow();
  });

  it('accepts the platform-provided web-service port', () => {
    expect(parseApiEnvironment({ PORT: '10000' }).PORT).toBe(10000);
  });

  it('rejects local session keys in production', () => {
    expect(() => parseApiEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Production session keys must be explicitly configured.'
    );
  });
});
