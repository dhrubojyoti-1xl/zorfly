import type { AiCapability, AiMessage } from '@zorfly/ai-core';
import type { AIExecutionPurpose } from '@zorfly/database';

export interface GenerateExecutionInput<TOutput = unknown> {
  tenantId: string;
  actorId?: string;
  purpose: AIExecutionPurpose;
  /** Selects the tenant's `AIModelConfiguration.key` for this purpose. */
  configurationKey: string;
  capability: AiCapability;
  messages: readonly AiMessage[];
  outputSchema?: Readonly<Record<string, unknown>>;
  validateOutput?: (value: unknown) => TOutput;
  maxOutputTokens?: number;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
}

export interface GenerateExecutionResult<TOutput = unknown> {
  executionPublicId: string;
  output: TOutput;
  providerKey: string;
  modelKey: string;
  reused: boolean;
}
