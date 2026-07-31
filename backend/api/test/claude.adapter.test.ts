import { describe, expect, it, vi } from 'vitest';
import { ClaudeAdapter } from '../src/modules/ai/providers/claude.adapter.js';
import type { HttpTransport } from '../src/modules/ai/providers/http-transport.js';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function transport(fetchImpl: HttpTransport['fetch']): HttpTransport {
  return { fetch: fetchImpl };
}

describe('ClaudeAdapter', () => {
  it('sends system/user turns and returns parsed structured output', async () => {
    const fetchImpl = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.system).toBe('Be terse.');
      expect(body.messages).toEqual([{ role: 'user', content: 'Create a question.' }]);
      expect((body.output_config as { format: { type: string } }).format.type).toBe('json_schema');
      return Promise.resolve(
        jsonResponse(
          200,
          {
            content: [{ type: 'text', text: '{"questions":[]}' }],
            model: 'claude-sonnet-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 12, output_tokens: 4, cache_read_input_tokens: 2 }
          },
          { 'request-id': 'req_abc123' }
        )
      );
    });

    const adapter = new ClaudeAdapter({
      apiKey: 'test-key',
      transport: transport(fetchImpl)
    });

    const result = await adapter.generate(
      {
        capability: 'structured_output',
        messages: [
          { role: 'system', content: 'Be terse.' },
          { role: 'user', content: 'Create a question.' }
        ],
        outputSchema: { type: 'object' },
        idempotencyKey: 'tenant:question-generation:1'
      },
      new AbortController().signal
    );

    expect(result.output).toEqual({ questions: [] });
    expect(result.providerKey).toBe('claude');
    expect(result.providerRequestId).toBe('req_abc123');
    expect(result.usage.cachedInputTokens).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a retryable rate_limit error on HTTP 429', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse(429, { error: { type: 'rate_limit_error', message: 'busy' } }))
    );
    const adapter = new ClaudeAdapter({ apiKey: 'test-key', transport: transport(fetchImpl) });

    await expect(
      adapter.generate(
        {
          capability: 'text',
          messages: [{ role: 'user', content: 'Hi' }],
          idempotencyKey: 'tenant:x:1'
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ category: 'rate_limit', retryable: true, statusCode: 429 });
  });

  it('throws a non-retryable safety error when Claude refuses', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          content: [],
          model: 'claude-sonnet-5',
          stop_reason: 'refusal',
          usage: { input_tokens: 5, output_tokens: 0 }
        })
      )
    );
    const adapter = new ClaudeAdapter({ apiKey: 'test-key', transport: transport(fetchImpl) });

    await expect(
      adapter.generate(
        {
          capability: 'text',
          messages: [{ role: 'user', content: 'Hi' }],
          idempotencyKey: 'tenant:x:1'
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ category: 'safety', retryable: false });
  });
});
