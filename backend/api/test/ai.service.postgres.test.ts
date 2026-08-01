import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AIExecutionPurpose, TenantStatus, createPrismaClient } from '@zorfly/database';
import {
  ensureModelConfiguration,
  ensureProviderCatalog,
  ensureTenantProviderConfiguration
} from '../src/modules/ai/ai.repository.js';
import { AiExecutionService } from '../src/modules/ai/ai.service.js';
import { InMemorySecretResolver } from '../src/modules/ai/secret-resolver.js';
import type { HttpTransport } from '../src/modules/ai/providers/http-transport.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));
const prisma = connectionString ? createPrismaClient(connectionString) : null;

afterAll(async () => {
  await prisma?.$disconnect();
});

const pricedCatalog = [
  {
    providerKey: 'claude',
    providerName: 'Anthropic Claude',
    modelKey: 'claude-sonnet-5',
    modelDisplayName: 'Claude Sonnet 5',
    capabilities: ['text', 'structured_output'],
    inputPricePerMillion: 3,
    outputPricePerMillion: 15
  }
] as const;

function claudeSuccessResponse(): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text: '{"questions":[]}' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0 }
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_1' } }
  );
}

async function createTenant(): Promise<string> {
  if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
  const suffix = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({
    data: {
      code: `ai-${suffix}`,
      slug: `ai-${suffix}`,
      name: `AI Test Tenant ${suffix}`,
      status: TenantStatus.ACTIVE
    }
  });
  return tenant.id;
}

integration('AiExecutionService (PostgreSQL-backed)', () => {
  it('executes, persists usage/cost, and is idempotent', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    await ensureProviderCatalog(prisma, pricedCatalog);
    const tenantId = await createTenant();
    await ensureTenantProviderConfiguration(prisma, tenantId, 'claude', 'TEST_CLAUDE_KEY');
    await ensureModelConfiguration(prisma, {
      tenantId,
      key: 'question-generation.default',
      purpose: AIExecutionPurpose.QUESTION_GENERATION,
      providerKey: 'claude',
      modelKey: 'claude-sonnet-5'
    });

    const fetchImpl = vi.fn(() => Promise.resolve(claudeSuccessResponse()));
    const transport: HttpTransport = { fetch: fetchImpl };
    const service = new AiExecutionService({
      prisma,
      secretResolver: new InMemorySecretResolver({ TEST_CLAUDE_KEY: 'sk-test' }),
      transport
    });

    const idempotencyKey = `tenant:${tenantId}:question-generation:${randomUUID()}`;
    const first = await service.generate<{ questions: unknown[] }>({
      tenantId,
      purpose: AIExecutionPurpose.QUESTION_GENERATION,
      configurationKey: 'question-generation.default',
      capability: 'structured_output',
      messages: [{ role: 'user', content: 'Generate a question.' }],
      outputSchema: { type: 'object' },
      idempotencyKey
    });

    expect(first.output).toEqual({ questions: [] });
    expect(first.reused).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const execution = await prisma.aIPromptExecution.findUniqueOrThrow({
      where: { publicId: first.executionPublicId }
    });
    expect(execution.status).toBe('SUCCEEDED');
    expect(execution.tenantId).toBe(tenantId);

    const tokenUsage = await prisma.aITokenUsage.findMany({ where: { executionId: execution.id } });
    expect(tokenUsage).toHaveLength(1);
    expect(tokenUsage[0]?.inputTokens).toBe(100);
    expect(tokenUsage[0]?.outputTokens).toBe(50);

    const costEntries = await prisma.aICostTracking.findMany({
      where: { executionId: execution.id }
    });
    expect(costEntries).toHaveLength(2);

    const second = await service.generate<{ questions: unknown[] }>({
      tenantId,
      purpose: AIExecutionPurpose.QUESTION_GENERATION,
      configurationKey: 'question-generation.default',
      capability: 'structured_output',
      messages: [{ role: 'user', content: 'Generate a question.' }],
      outputSchema: { type: 'object' },
      idempotencyKey
    });
    expect(second.reused).toBe(true);
    expect(second.output).toEqual({ questions: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  }, 15_000);

  it('rejects generation for a tenant with no AI provider configuration', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    await ensureProviderCatalog(prisma, pricedCatalog);
    const tenantId = await createTenant();
    const service = new AiExecutionService({
      prisma,
      secretResolver: new InMemorySecretResolver(),
      transport: { fetch: vi.fn() }
    });

    await expect(
      service.generate({
        tenantId,
        purpose: AIExecutionPurpose.QUESTION_GENERATION,
        configurationKey: 'question-generation.default',
        capability: 'structured_output',
        messages: [{ role: 'user', content: 'Hi' }],
        idempotencyKey: `tenant:${tenantId}:x:1`
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('blocks execution once the daily budget is exhausted', async () => {
    if (!prisma) throw new Error('TEST_DATABASE_URL is required.');
    await ensureProviderCatalog(prisma, pricedCatalog);
    const tenantId = await createTenant();
    await ensureTenantProviderConfiguration(prisma, tenantId, 'claude', 'TEST_CLAUDE_KEY');
    await ensureModelConfiguration(prisma, {
      tenantId,
      key: 'question-generation.default',
      purpose: AIExecutionPurpose.QUESTION_GENERATION,
      providerKey: 'claude',
      modelKey: 'claude-sonnet-5',
      dailyBudget: 0.0005
    });

    const fetchImpl = vi.fn(() => Promise.resolve(claudeSuccessResponse()));
    const service = new AiExecutionService({
      prisma,
      secretResolver: new InMemorySecretResolver({ TEST_CLAUDE_KEY: 'sk-test' }),
      transport: { fetch: fetchImpl }
    });

    await service.generate({
      tenantId,
      purpose: AIExecutionPurpose.QUESTION_GENERATION,
      configurationKey: 'question-generation.default',
      capability: 'structured_output',
      messages: [{ role: 'user', content: 'Generate a question.' }],
      outputSchema: { type: 'object' },
      idempotencyKey: `tenant:${tenantId}:budget:1`
    });

    await expect(
      service.generate({
        tenantId,
        purpose: AIExecutionPurpose.QUESTION_GENERATION,
        configurationKey: 'question-generation.default',
        capability: 'structured_output',
        messages: [{ role: 'user', content: 'Generate another question.' }],
        outputSchema: { type: 'object' },
        idempotencyKey: `tenant:${tenantId}:budget:2`
      })
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
