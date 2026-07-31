import { describe, expect, it, vi } from 'vitest';
import { OpenAiAdapter } from '../src/modules/ai/providers/openai.adapter.js';
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

describe('OpenAiAdapter', () => {
  it('sends Responses API input and returns parsed structured output', async () => {
    const fetchImpl = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('https://api.openai.com/v1/responses');
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.input).toEqual([
        { role: 'system', content: 'Be terse.' },
        { role: 'user', content: 'Create a question.' }
      ]);
      expect((body.text as { format: { type: string } }).format.type).toBe('json_schema');
      return Promise.resolve(
        jsonResponse(
          200,
          {
            id: 'resp_123',
            model: 'gpt-5.6',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: '{"questions":[]}' }]
              }
            ],
            usage: {
              input_tokens: 12,
              output_tokens: 4,
              input_tokens_details: { cached_tokens: 2 }
            }
          },
          { 'x-request-id': 'req_abc123' }
        )
      );
    });

    const adapter = new OpenAiAdapter({
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
    expect(result.providerKey).toBe('openai');
    expect(result.providerRequestId).toBe('req_abc123');
    expect(result.usage.cachedInputTokens).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a retryable rate_limit error on HTTP 429', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse(429, { error: { type: 'rate_limit_error', message: 'busy' } }))
    );
    const adapter = new OpenAiAdapter({ apiKey: 'test-key', transport: transport(fetchImpl) });

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

  it('throws a non-retryable invalid_response error when the response is incomplete', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          id: 'resp_456',
          model: 'gpt-5.6',
          status: 'incomplete',
          output: [],
          usage: { input_tokens: 5, output_tokens: 0 }
        })
      )
    );
    const adapter = new OpenAiAdapter({ apiKey: 'test-key', transport: transport(fetchImpl) });

    await expect(
      adapter.generate(
        {
          capability: 'text',
          messages: [{ role: 'user', content: 'Hi' }],
          idempotencyKey: 'tenant:x:1'
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ category: 'invalid_response', retryable: false });
  });
});
