export type AiCapability =
  | 'text'
  | 'structured_output'
  | 'vision'
  | 'image_generation'
  | 'image_edit'
  | 'tools'
  | 'embeddings';

export type AiErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'rate_limit'
  | 'overloaded'
  | 'timeout'
  | 'safety'
  | 'invalid_request'
  | 'invalid_response'
  | 'unavailable'
  | 'unknown';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AiUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export interface AiRequest<TOutput = unknown> {
  capability: AiCapability;
  messages: readonly AiMessage[];
  outputSchema?: Readonly<Record<string, unknown>>;
  validateOutput?: (value: unknown) => TOutput;
  maxOutputTokens?: number;
  temperature?: number;
  idempotencyKey: string;
  safetyIdentifier?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface AiResponse<TOutput = unknown> {
  output: TOutput;
  providerKey: string;
  modelKey: string;
  providerRequestId?: string;
  finishReason?: string;
  continuationToken?: string;
  usage: AiUsage;
  latencyMs: number;
}

export class AiProviderError extends Error {
  public constructor(
    message: string,
    public readonly category: AiErrorCategory,
    public readonly retryable: boolean,
    public readonly providerKey?: string,
    public readonly statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}

export interface AiProviderAdapter {
  readonly key: string;
  readonly modelKey: string;
  readonly capabilities: ReadonlySet<AiCapability>;
  generate(request: AiRequest, signal: AbortSignal): Promise<Omit<AiResponse, 'latencyMs'>>;
}

export interface AiGatewayPolicy {
  timeoutMs: number;
  attemptsPerProvider: number;
  retryBaseDelayMs: number;
  maxProviderHops: number;
}

export interface AiGatewayEvent {
  type: 'started' | 'retrying' | 'failed_over' | 'completed' | 'failed';
  providerKey: string;
  modelKey: string;
  attempt: number;
  category?: AiErrorCategory;
  latencyMs?: number;
}

export interface AiGatewayOptions {
  adapters: readonly AiProviderAdapter[];
  policy?: Partial<AiGatewayPolicy>;
  onEvent?: (event: AiGatewayEvent) => void;
  random?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}

const defaultPolicy: AiGatewayPolicy = {
  timeoutMs: 60_000,
  attemptsPerProvider: 2,
  retryBaseDelayMs: 250,
  maxProviderHops: 3
};

function normalizeError(error: unknown, providerKey: string): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AiProviderError('AI request timed out.', 'timeout', true, providerKey, undefined, {
      cause: error
    });
  }
  return new AiProviderError(
    'The AI provider request failed.',
    'unknown',
    false,
    providerKey,
    undefined,
    { cause: error }
  );
}

export class AiGateway {
  private readonly policy: AiGatewayPolicy;
  private readonly adapters: readonly AiProviderAdapter[];
  private readonly onEvent: (event: AiGatewayEvent) => void;
  private readonly random: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(options: AiGatewayOptions) {
    if (options.adapters.length === 0) throw new Error('At least one AI adapter is required.');
    this.adapters = options.adapters;
    this.policy = { ...defaultPolicy, ...options.policy };
    this.onEvent = options.onEvent ?? (() => undefined);
    this.random = options.random ?? Math.random;
    this.wait =
      options.wait ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  public async generate<TOutput>(request: AiRequest<TOutput>): Promise<AiResponse<TOutput>> {
    if (!request.idempotencyKey.trim()) throw new Error('AI requests require an idempotency key.');
    const eligible = this.adapters
      .filter((adapter) => adapter.capabilities.has(request.capability))
      .slice(0, this.policy.maxProviderHops);
    if (eligible.length === 0) {
      throw new AiProviderError(
        `No configured AI provider supports ${request.capability}.`,
        'unavailable',
        false
      );
    }
    let lastError: AiProviderError | null = null;
    for (const [providerIndex, adapter] of eligible.entries()) {
      for (let attempt = 1; attempt <= this.policy.attemptsPerProvider; attempt += 1) {
        const started = Date.now();
        this.onEvent({
          type: 'started',
          providerKey: adapter.key,
          modelKey: adapter.modelKey,
          attempt
        });
        try {
          const response = await this.withTimeout(adapter, request);
          let output = response.output as TOutput;
          if (request.validateOutput) {
            try {
              output = request.validateOutput(response.output);
            } catch (error) {
              throw new AiProviderError(
                'The AI provider returned output that failed validation.',
                'invalid_response',
                false,
                adapter.key,
                undefined,
                { cause: error }
              );
            }
          }
          const latencyMs = Date.now() - started;
          this.onEvent({
            type: 'completed',
            providerKey: adapter.key,
            modelKey: adapter.modelKey,
            attempt,
            latencyMs
          });
          return { ...response, output, latencyMs };
        } catch (error) {
          lastError = normalizeError(error, adapter.key);
          const retry = lastError.retryable && attempt < this.policy.attemptsPerProvider;
          this.onEvent({
            type: retry ? 'retrying' : 'failed',
            providerKey: adapter.key,
            modelKey: adapter.modelKey,
            attempt,
            category: lastError.category,
            latencyMs: Date.now() - started
          });
          if (retry) {
            const exponential = this.policy.retryBaseDelayMs * 2 ** (attempt - 1);
            await this.wait(Math.round(exponential * (0.75 + this.random() * 0.5)));
            continue;
          }
          break;
        }
      }
      if (providerIndex < eligible.length - 1) {
        const next = eligible[providerIndex + 1];
        if (next) {
          this.onEvent({
            type: 'failed_over',
            providerKey: next.key,
            modelKey: next.modelKey,
            attempt: 0,
            ...(lastError ? { category: lastError.category } : {})
          });
        }
      }
    }
    throw (
      lastError ??
      new AiProviderError('No AI provider completed the request.', 'unavailable', false)
    );
  }

  private async withTimeout(
    adapter: AiProviderAdapter,
    request: AiRequest
  ): Promise<Omit<AiResponse, 'latencyMs'>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.policy.timeoutMs);
    try {
      return await adapter.generate(request, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }
}
