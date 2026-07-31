import { describe, expect, it, vi } from 'vitest';
import {
  AiGateway,
  AiProviderError,
  type AiProviderAdapter,
  type AiRequest
} from '../src/index.js';

const request: AiRequest<{ questions: unknown[] }> = {
  capability: 'structured_output',
  messages: [{ role: 'user', content: 'Create a question.' }],
  idempotencyKey: 'tenant:question-generation:1',
  validateOutput(value) {
    if (!value || typeof value !== 'object' || !('questions' in value)) {
      throw new Error('questions is required');
    }
    return value as { questions: unknown[] };
  }
};

function adapter(key: string, generate: AiProviderAdapter['generate']): AiProviderAdapter {
  return {
    key,
    modelKey: `${key}-model`,
    capabilities: new Set(['structured_output']),
    generate
  };
}

describe('AiGateway', () => {
  it('retries transient failures and preserves normalized usage', async () => {
    const generate = vi
      .fn<AiProviderAdapter['generate']>()
      .mockRejectedValueOnce(new AiProviderError('busy', 'rate_limit', true, 'primary', 429))
      .mockResolvedValue({
        output: { questions: [] },
        providerKey: 'primary',
        modelKey: 'primary-model',
        usage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 5, reasoningTokens: 0 }
      });
    const gateway = new AiGateway({
      adapters: [adapter('primary', generate)],
      wait: () => Promise.resolve(),
      random: () => 0
    });
    const result = await gateway.generate(request);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.output).toEqual({ questions: [] });
    expect(result.usage.cachedInputTokens).toBe(2);
  });

  it('fails over without leaking provider-specific types', async () => {
    const gateway = new AiGateway({
      adapters: [
        adapter('primary', () =>
          Promise.reject(new AiProviderError('down', 'unavailable', false, 'primary', 503))
        ),
        adapter('secondary', () =>
          Promise.resolve({
            output: { questions: [{ title: 'Safe tenancy' }] },
            providerKey: 'secondary',
            modelKey: 'secondary-model',
            usage: {
              inputTokens: 12,
              cachedInputTokens: 0,
              outputTokens: 8,
              reasoningTokens: 0
            }
          })
        )
      ],
      policy: { attemptsPerProvider: 1 }
    });
    const result = await gateway.generate(request);
    expect(result.providerKey).toBe('secondary');
  });

  it('rejects invalid structured output at the trust boundary', async () => {
    const gateway = new AiGateway({
      adapters: [
        adapter('primary', () =>
          Promise.resolve({
            output: { unexpected: true },
            providerKey: 'primary',
            modelKey: 'primary-model',
            usage: {
              inputTokens: 1,
              cachedInputTokens: 0,
              outputTokens: 1,
              reasoningTokens: 0
            }
          })
        )
      ],
      policy: { attemptsPerProvider: 1 }
    });
    await expect(gateway.generate(request)).rejects.toMatchObject({
      category: 'invalid_response'
    });
  });
});
