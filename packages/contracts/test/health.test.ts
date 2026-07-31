import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../src/index.js';

describe('healthResponseSchema', () => {
  it('accepts the public health contract', () => {
    expect(
      healthResponseSchema.safeParse({
        data: { service: 'api', status: 'ok', version: '0.1.0' },
        meta: { requestId: '019fb696-ac43-70d2-8008-26f6569888d7' }
      }).success
    ).toBe(true);
  });
});
