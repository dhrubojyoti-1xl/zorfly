import type { AiProviderAdapter } from '@zorfly/ai-core';
import { ClaudeAdapter } from './providers/claude.adapter.js';
import { OpenAiAdapter } from './providers/openai.adapter.js';
import type { HttpTransport } from './providers/http-transport.js';

export interface BuildAdapterInput {
  providerKey: string;
  modelKey: string;
  apiKey: string;
  transport?: HttpTransport;
}

/** Maps an `AIProvider.key` to its adapter implementation. Unknown keys are a configuration error. */
export function buildProviderAdapter(input: BuildAdapterInput): AiProviderAdapter {
  const options = {
    apiKey: input.apiKey,
    modelKey: input.modelKey,
    ...(input.transport ? { transport: input.transport } : {})
  };
  switch (input.providerKey) {
    case 'claude':
      return new ClaudeAdapter(options);
    case 'openai':
      return new OpenAiAdapter(options);
    default:
      throw new Error(`No adapter is registered for AI provider "${input.providerKey}".`);
  }
}
