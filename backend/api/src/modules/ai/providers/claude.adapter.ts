import {
  AiProviderError,
  type AiCapability,
  type AiErrorCategory,
  type AiProviderAdapter,
  type AiRequest,
  type AiResponse
} from '@zorfly/ai-core';
import { globalFetchTransport, type HttpTransport } from './http-transport.js';

export interface ClaudeAdapterOptions {
  apiKey: string;
  modelKey?: string;
  baseUrl?: string;
  transport?: HttpTransport;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
}

interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
}

interface ClaudeMessageResponse {
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: string;
  stop_sequence?: string | null;
  usage: ClaudeUsage;
}

interface ClaudeErrorBody {
  error?: { type?: string; message?: string };
}

const statusToCategory: Record<number, { category: AiErrorCategory; retryable: boolean }> = {
  400: { category: 'invalid_request', retryable: false },
  401: { category: 'authentication', retryable: false },
  403: { category: 'authorization', retryable: false },
  404: { category: 'invalid_request', retryable: false },
  413: { category: 'invalid_request', retryable: false },
  429: { category: 'rate_limit', retryable: true },
  500: { category: 'unavailable', retryable: true },
  529: { category: 'overloaded', retryable: true }
};

function classifyStatus(status: number): { category: AiErrorCategory; retryable: boolean } {
  const known = statusToCategory[status];
  if (known) return known;
  return status >= 500
    ? { category: 'unavailable', retryable: true }
    : { category: 'unknown', retryable: false };
}

/** The Claude Messages API has no `role: "tool"` — fold tool-role turns into user turns. */
function toClaudeMessages(messages: readonly AiRequest['messages'][number][]): {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemParts: string[] = [];
  const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    claudeMessages.push({ role, content: message.content });
  }
  return systemParts.length > 0
    ? { system: systemParts.join('\n\n'), messages: claudeMessages }
    : { messages: claudeMessages };
}

function extractText(content: readonly ClaudeContentBlock[]): string {
  const textBlock = content.find((block) => block.type === 'text');
  return textBlock?.text ?? '';
}

export class ClaudeAdapter implements AiProviderAdapter {
  public readonly key = 'claude';
  public readonly modelKey: string;
  public readonly capabilities: ReadonlySet<AiCapability> = new Set([
    'text',
    'structured_output',
    'vision'
  ]);

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly transport: HttpTransport;

  public constructor(options: ClaudeAdapterOptions) {
    this.apiKey = options.apiKey;
    this.modelKey = options.modelKey ?? 'claude-sonnet-5';
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
    this.transport = options.transport ?? globalFetchTransport;
  }

  public async generate(
    request: AiRequest,
    signal: AbortSignal
  ): Promise<Omit<AiResponse, 'latencyMs'>> {
    const { system, messages } = toClaudeMessages(request.messages);
    const body: Record<string, unknown> = {
      model: this.modelKey,
      max_tokens: request.maxOutputTokens ?? 4096,
      messages
    };
    if (system) body.system = system;
    if (request.outputSchema) {
      body.output_config = { format: { type: 'json_schema', schema: request.outputSchema } };
    }

    const response = await this.transport.fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    });

    const providerRequestId = response.headers.get('request-id') ?? undefined;

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => undefined)) as
        ClaudeErrorBody | undefined;
      const { category, retryable } = classifyStatus(response.status);
      throw new AiProviderError(
        errorBody?.error?.message ?? 'The Claude API request failed.',
        category,
        retryable,
        this.key,
        response.status
      );
    }

    const data = (await response.json()) as ClaudeMessageResponse;

    if (data.stop_reason === 'refusal') {
      throw new AiProviderError(
        'Claude declined the request for safety reasons.',
        'safety',
        false,
        this.key,
        response.status
      );
    }

    const text = extractText(data.content);
    const output: unknown = request.outputSchema ? JSON.parse(text) : text;

    return {
      output,
      providerKey: this.key,
      modelKey: data.model,
      ...(providerRequestId ? { providerRequestId } : {}),
      finishReason: data.stop_reason,
      usage: {
        inputTokens: data.usage.input_tokens,
        cachedInputTokens: data.usage.cache_read_input_tokens ?? 0,
        outputTokens: data.usage.output_tokens,
        reasoningTokens: 0
      }
    };
  }
}
