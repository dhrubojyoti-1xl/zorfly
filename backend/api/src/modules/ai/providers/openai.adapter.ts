import {
  AiProviderError,
  type AiCapability,
  type AiErrorCategory,
  type AiProviderAdapter,
  type AiRequest,
  type AiResponse
} from '@zorfly/ai-core';
import { globalFetchTransport, type HttpTransport } from './http-transport.js';

export interface OpenAiAdapterOptions {
  apiKey: string;
  modelKey?: string;
  baseUrl?: string;
  transport?: HttpTransport;
}

interface OpenAiOutputTextContent {
  type: 'output_text';
  text: string;
}

interface OpenAiOutputItem {
  type: string;
  content?: OpenAiOutputTextContent[];
}

interface OpenAiUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
}

interface OpenAiResponseBody {
  id: string;
  model: string;
  status: string;
  output: OpenAiOutputItem[];
  output_text?: string;
  usage: OpenAiUsage;
}

interface OpenAiErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

const statusToCategory: Record<number, { category: AiErrorCategory; retryable: boolean }> = {
  400: { category: 'invalid_request', retryable: false },
  401: { category: 'authentication', retryable: false },
  403: { category: 'authorization', retryable: false },
  404: { category: 'invalid_request', retryable: false },
  429: { category: 'rate_limit', retryable: true },
  500: { category: 'unavailable', retryable: true },
  503: { category: 'overloaded', retryable: true }
};

function classifyStatus(status: number): { category: AiErrorCategory; retryable: boolean } {
  const known = statusToCategory[status];
  if (known) return known;
  return status >= 500
    ? { category: 'unavailable', retryable: true }
    : { category: 'unknown', retryable: false };
}

function toResponsesInput(
  messages: readonly AiRequest['messages'][number][]
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return messages.map((message) => ({
    role: message.role === 'tool' ? 'user' : message.role,
    content: message.content
  }));
}

function extractOutputText(body: OpenAiResponseBody): string {
  if (body.output_text) return body.output_text;
  for (const item of body.output) {
    const textBlock = item.content?.find((block) => block.type === 'output_text');
    if (textBlock) return textBlock.text;
  }
  return '';
}

export class OpenAiAdapter implements AiProviderAdapter {
  public readonly key = 'openai';
  public readonly modelKey: string;
  public readonly capabilities: ReadonlySet<AiCapability> = new Set([
    'text',
    'structured_output',
    'vision'
  ]);

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly transport: HttpTransport;

  public constructor(options: OpenAiAdapterOptions) {
    this.apiKey = options.apiKey;
    this.modelKey = options.modelKey ?? 'gpt-5.6';
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com';
    this.transport = options.transport ?? globalFetchTransport;
  }

  public async generate(
    request: AiRequest,
    signal: AbortSignal
  ): Promise<Omit<AiResponse, 'latencyMs'>> {
    const body: Record<string, unknown> = {
      model: this.modelKey,
      input: toResponsesInput(request.messages),
      max_output_tokens: request.maxOutputTokens ?? 4096
    };
    if (request.outputSchema) {
      body.text = {
        format: {
          type: 'json_schema',
          name: 'ai_gateway_output',
          schema: request.outputSchema,
          strict: true
        }
      };
    }

    const response = await this.transport.fetch(`${this.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    });

    const providerRequestId = response.headers.get('x-request-id') ?? undefined;

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => undefined)) as
        OpenAiErrorBody | undefined;
      const { category, retryable } = classifyStatus(response.status);
      throw new AiProviderError(
        errorBody?.error?.message ?? 'The OpenAI Responses API request failed.',
        category,
        retryable,
        this.key,
        response.status
      );
    }

    const data = (await response.json()) as OpenAiResponseBody;

    if (data.status === 'failed' || data.status === 'incomplete') {
      throw new AiProviderError(
        `The OpenAI Responses API returned status "${data.status}".`,
        'invalid_response',
        false,
        this.key,
        response.status
      );
    }

    const text = extractOutputText(data);
    const output: unknown = request.outputSchema ? JSON.parse(text) : text;

    return {
      output,
      providerKey: this.key,
      modelKey: data.model,
      ...(providerRequestId ? { providerRequestId } : {}),
      finishReason: data.status,
      usage: {
        inputTokens: data.usage.input_tokens,
        cachedInputTokens: data.usage.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: data.usage.output_tokens,
        reasoningTokens: data.usage.output_tokens_details?.reasoning_tokens ?? 0
      }
    };
  }
}
