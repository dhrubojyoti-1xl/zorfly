import { createHash } from 'node:crypto';
import {
  AIExecutionStatus,
  RecordStatus,
  VersionStatus,
  type AIExecutionPurpose,
  type Prisma,
  type ZorflyPrismaClient
} from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';

export interface ProviderCatalogEntry {
  providerKey: string;
  providerName: string;
  modelKey: string;
  modelDisplayName: string;
  capabilities: readonly string[];
  contextWindowTokens?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
}

const defaultCatalog: readonly ProviderCatalogEntry[] = [
  {
    providerKey: 'claude',
    providerName: 'Anthropic Claude',
    modelKey: 'claude-sonnet-5',
    modelDisplayName: 'Claude Sonnet 5',
    capabilities: ['text', 'structured_output', 'vision']
  },
  {
    providerKey: 'openai',
    providerName: 'OpenAI',
    modelKey: 'gpt-5.6',
    modelDisplayName: 'GPT-5.6',
    capabilities: ['text', 'structured_output', 'vision']
  }
];

/** Idempotently seeds the platform AI provider/model catalogue (no credentials). */
export async function ensureProviderCatalog(
  prisma: ZorflyPrismaClient,
  entries: readonly ProviderCatalogEntry[] = defaultCatalog
): Promise<void> {
  for (const entry of entries) {
    const provider = await prisma.aIProvider.upsert({
      where: { key: entry.providerKey },
      create: {
        key: entry.providerKey,
        name: entry.providerName,
        capabilities: { capabilities: entry.capabilities },
        status: RecordStatus.ACTIVE
      },
      update: { name: entry.providerName }
    });
    await prisma.aIModel.upsert({
      where: {
        providerId_providerModelKey: { providerId: provider.id, providerModelKey: entry.modelKey }
      },
      create: {
        providerId: provider.id,
        providerModelKey: entry.modelKey,
        displayName: entry.modelDisplayName,
        capabilities: { capabilities: entry.capabilities },
        ...(entry.contextWindowTokens ? { contextWindowTokens: entry.contextWindowTokens } : {}),
        ...(entry.inputPricePerMillion !== undefined
          ? { inputPricePerMillion: entry.inputPricePerMillion }
          : {}),
        ...(entry.outputPricePerMillion !== undefined
          ? { outputPricePerMillion: entry.outputPricePerMillion }
          : {}),
        status: RecordStatus.ACTIVE
      },
      update: { displayName: entry.modelDisplayName }
    });
  }
}

export async function ensureTenantProviderConfiguration(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  providerKey: string,
  secretReference: string
): Promise<void> {
  const provider = await prisma.aIProvider.findUniqueOrThrow({ where: { key: providerKey } });
  await prisma.tenantAIProviderConfiguration.upsert({
    where: { tenantId_providerId: { tenantId, providerId: provider.id } },
    create: { tenantId, providerId: provider.id, secretReference, status: RecordStatus.ACTIVE },
    update: { secretReference, status: RecordStatus.ACTIVE, deletedAt: null }
  });
}

export interface ModelConfigurationInput {
  tenantId: string;
  key: string;
  purpose: AIExecutionPurpose;
  providerKey: string;
  modelKey: string;
  maxOutputTokens?: number;
  dailyBudget?: number;
  monthlyBudget?: number;
  /** Ordered `AIModelConfiguration.key` values tried after this one on failure. */
  fallbackChainKeys?: readonly string[];
}

export async function ensureModelConfiguration(
  prisma: ZorflyPrismaClient,
  input: ModelConfigurationInput
): Promise<void> {
  const provider = await prisma.aIProvider.findUniqueOrThrow({
    where: { key: input.providerKey }
  });
  const model = await prisma.aIModel.findUniqueOrThrow({
    where: {
      providerId_providerModelKey: { providerId: provider.id, providerModelKey: input.modelKey }
    }
  });
  const data = {
    modelId: model.id,
    purpose: input.purpose,
    parameters: {},
    ...(input.fallbackChainKeys
      ? { fallbackChain: { keys: input.fallbackChainKeys } as Prisma.InputJsonValue }
      : {}),
    ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
    ...(input.dailyBudget !== undefined ? { dailyBudget: input.dailyBudget } : {}),
    ...(input.monthlyBudget !== undefined ? { monthlyBudget: input.monthlyBudget } : {}),
    status: RecordStatus.ACTIVE
  };
  await prisma.aIModelConfiguration.upsert({
    where: { tenantId_key: { tenantId: input.tenantId, key: input.key } },
    create: { tenantId: input.tenantId, key: input.key, ...data },
    update: data
  });
}

export const RESPONSE_EVALUATION_CONFIGURATION_KEY = 'response-evaluation.default';
export const REPORT_GENERATION_CONFIGURATION_KEY = 'report-generation.default';

/** Enables the platform Claude key for a tenant without ever persisting the key itself. */
export async function ensureDefaultClaudeConfiguration(
  prisma: ZorflyPrismaClient,
  tenantId: string
): Promise<void> {
  await ensureProviderCatalog(prisma);
  await ensureTenantProviderConfiguration(prisma, tenantId, 'claude', 'ANTHROPIC_API_KEY');
  await ensureModelConfiguration(prisma, {
    tenantId,
    key: 'question-generation.default',
    purpose: 'QUESTION_GENERATION',
    providerKey: 'claude',
    modelKey: 'claude-sonnet-5'
  });
  await ensureModelConfiguration(prisma, {
    tenantId,
    key: RESPONSE_EVALUATION_CONFIGURATION_KEY,
    purpose: 'RESPONSE_EVALUATION',
    providerKey: 'claude',
    modelKey: 'claude-sonnet-5'
  });
  await ensureModelConfiguration(prisma, {
    tenantId,
    key: REPORT_GENERATION_CONFIGURATION_KEY,
    purpose: 'RECOMMENDATION',
    providerKey: 'claude',
    modelKey: 'claude-sonnet-5'
  });
}

export interface PromptVersionInput {
  tenantId: string;
  key: string;
  purpose: AIExecutionPurpose;
  systemPrompt: string;
  variableSchema: Prisma.InputJsonValue;
  outputSchema: Prisma.InputJsonValue;
}

/** Publishes a new immutable prompt version only when the rendered content actually changed. */
export async function ensurePromptVersion(
  prisma: ZorflyPrismaClient,
  input: PromptVersionInput
): Promise<{ id: string; systemPrompt: string }> {
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ systemPrompt: input.systemPrompt, outputSchema: input.outputSchema }))
    .digest('hex');

  return prisma.$transaction(async (transaction) => {
    const existingPrompt = await transaction.aIPrompt.findUnique({
      where: { tenantId_key: { tenantId: input.tenantId, key: input.key } },
      include: { currentVersion: true }
    });
    if (existingPrompt?.currentVersion?.contentHash === contentHash) {
      return { id: existingPrompt.currentVersion.id, systemPrompt: input.systemPrompt };
    }

    const prompt =
      existingPrompt ??
      (await transaction.aIPrompt.create({
        data: {
          tenantId: input.tenantId,
          key: input.key,
          name: input.key,
          purpose: input.purpose,
          status: RecordStatus.ACTIVE
        }
      }));

    const latestVersion = await transaction.aIPromptVersion.findFirst({
      where: { promptId: prompt.id },
      orderBy: { versionNumber: 'desc' }
    });
    if (latestVersion && latestVersion.status === VersionStatus.PUBLISHED) {
      await transaction.aIPromptVersion.update({
        where: { id: latestVersion.id },
        data: { status: VersionStatus.SUPERSEDED }
      });
    }

    const version = await transaction.aIPromptVersion.create({
      data: {
        tenantId: input.tenantId,
        promptId: prompt.id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        status: VersionStatus.PUBLISHED,
        messages: [{ role: 'system', content: input.systemPrompt }],
        variableSchema: input.variableSchema,
        outputSchema: input.outputSchema,
        contentHash,
        publishedAt: new Date()
      }
    });
    await transaction.aIPrompt.update({
      where: { id: prompt.id },
      data: { currentVersionId: version.id }
    });
    return { id: version.id, systemPrompt: input.systemPrompt };
  });
}

export interface ResolvedModelConfiguration {
  configurationId: string;
  configurationKey: string;
  providerKey: string;
  modelKey: string;
  providerModelId: string;
  secretReference: string;
  maxOutputTokens: number | null;
  dailyBudget: number | null;
  monthlyBudget: number | null;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
}

async function loadResolvedConfiguration(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  configurationKey: string
): Promise<ResolvedModelConfiguration | null> {
  const configuration = await prisma.aIModelConfiguration.findUnique({
    where: { tenantId_key: { tenantId, key: configurationKey } },
    include: { model: { include: { provider: true } } }
  });
  if (!configuration || configuration.status !== RecordStatus.ACTIVE || configuration.deletedAt) {
    return null;
  }
  const tenantProviderConfiguration = await prisma.tenantAIProviderConfiguration.findUnique({
    where: {
      tenantId_providerId: { tenantId, providerId: configuration.model.providerId }
    }
  });
  if (
    !tenantProviderConfiguration ||
    tenantProviderConfiguration.status !== RecordStatus.ACTIVE ||
    tenantProviderConfiguration.deletedAt
  ) {
    return null;
  }
  return {
    configurationId: configuration.id,
    configurationKey: configuration.key,
    providerKey: configuration.model.provider.key,
    modelKey: configuration.model.providerModelKey,
    providerModelId: configuration.modelId,
    secretReference: tenantProviderConfiguration.secretReference,
    maxOutputTokens: configuration.maxOutputTokens,
    dailyBudget: configuration.dailyBudget ? Number(configuration.dailyBudget) : null,
    monthlyBudget: configuration.monthlyBudget ? Number(configuration.monthlyBudget) : null,
    inputPricePerMillion: configuration.model.inputPricePerMillion
      ? Number(configuration.model.inputPricePerMillion)
      : null,
    outputPricePerMillion: configuration.model.outputPricePerMillion
      ? Number(configuration.model.outputPricePerMillion)
      : null
  };
}

/** Loads the primary configuration and its fallback chain, in adapter-priority order. */
export async function resolveExecutionPlan(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  configurationKey: string
): Promise<readonly ResolvedModelConfiguration[]> {
  const primary = await loadResolvedConfiguration(prisma, tenantId, configurationKey);
  if (!primary) return [];

  const configuration = await prisma.aIModelConfiguration.findUnique({
    where: { tenantId_key: { tenantId, key: configurationKey } }
  });
  const fallbackChain = configuration?.fallbackChain as { keys?: string[] } | null;
  const fallbackKeys = Array.isArray(fallbackChain?.keys) ? fallbackChain.keys : [];

  const resolved: ResolvedModelConfiguration[] = [primary];
  for (const key of fallbackKeys) {
    const next = await loadResolvedConfiguration(prisma, tenantId, key);
    if (next) resolved.push(next);
  }
  return resolved;
}

/** Sums accepted spend for a configuration since `since` (used for budget enforcement). */
export async function sumCostSince(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  modelConfigurationId: string,
  since: Date
): Promise<number> {
  const result = await prisma.aICostTracking.aggregate({
    where: {
      tenantId,
      incurredAt: { gte: since },
      execution: { modelConfigurationId }
    },
    _sum: { amount: true }
  });
  return result._sum.amount ? Number(result._sum.amount) : 0;
}

export interface CreateExecutionInput {
  tenantId: string;
  promptVersionId?: string;
  modelConfigurationId: string;
  purpose: AIExecutionPurpose;
  idempotencyKey: string;
  inputHash: string;
  inputSnapshot: Prisma.InputJsonValue;
  sourceType?: string;
  sourceId?: string;
}

export interface CreatedExecution {
  id: bigint;
  publicId: string;
  status: AIExecutionStatus;
  outputSnapshot: Prisma.JsonValue;
  providerRequestId: string | null;
  reused: boolean;
}

/** Inserts a QUEUED execution row, or returns the pre-existing row for a reused idempotency key. */
export async function createExecution(
  prisma: ZorflyPrismaClient,
  input: CreateExecutionInput
): Promise<CreatedExecution> {
  try {
    const execution = await prisma.aIPromptExecution.create({
      data: {
        tenantId: input.tenantId,
        ...(input.promptVersionId ? { promptVersionId: input.promptVersionId } : {}),
        modelConfigurationId: input.modelConfigurationId,
        purpose: input.purpose,
        status: AIExecutionStatus.RUNNING,
        idempotencyKey: input.idempotencyKey,
        inputHash: input.inputHash,
        inputSnapshot: input.inputSnapshot,
        startedAt: new Date(),
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
        ...(input.sourceId ? { sourceId: input.sourceId } : {})
      }
    });
    return {
      id: execution.id,
      publicId: execution.publicId,
      status: execution.status,
      outputSnapshot: execution.outputSnapshot,
      providerRequestId: execution.providerRequestId,
      reused: false
    };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const existing = await prisma.aIPromptExecution.findUniqueOrThrow({
        where: {
          tenantId_idempotencyKey: {
            tenantId: input.tenantId,
            idempotencyKey: input.idempotencyKey
          }
        }
      });
      return {
        id: existing.id,
        publicId: existing.publicId,
        status: existing.status,
        outputSnapshot: existing.outputSnapshot,
        providerRequestId: existing.providerRequestId,
        reused: true
      };
    }
    throw error;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

export interface CompleteExecutionSuccessInput {
  executionId: bigint;
  outputSnapshot: Prisma.InputJsonValue;
  providerRequestId?: string;
  latencyMs: number;
}

export async function completeExecutionSuccess(
  prisma: ZorflyPrismaClient,
  input: CompleteExecutionSuccessInput
): Promise<void> {
  await prisma.aIPromptExecution.update({
    where: { id: input.executionId },
    data: {
      status: AIExecutionStatus.SUCCEEDED,
      outputSnapshot: input.outputSnapshot,
      ...(input.providerRequestId ? { providerRequestId: input.providerRequestId } : {}),
      latencyMs: input.latencyMs,
      completedAt: new Date()
    }
  });
}

export interface CompleteExecutionFailureInput {
  executionId: bigint;
  status: typeof AIExecutionStatus.FAILED | typeof AIExecutionStatus.BLOCKED;
  failureCode: string;
  failureDetail?: Prisma.InputJsonValue;
}

export async function completeExecutionFailure(
  prisma: ZorflyPrismaClient,
  input: CompleteExecutionFailureInput
): Promise<void> {
  await prisma.aIPromptExecution.update({
    where: { id: input.executionId },
    data: {
      status: input.status,
      failureCode: input.failureCode,
      ...(input.failureDetail !== undefined ? { failureDetail: input.failureDetail } : {}),
      completedAt: new Date()
    }
  });
}

export interface TokenUsageInput {
  tenantId: string;
  executionId: bigint;
  providerModelKey: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export async function recordTokenUsage(
  prisma: ZorflyPrismaClient,
  input: TokenUsageInput
): Promise<void> {
  await prisma.aITokenUsage.create({
    data: {
      tenantId: input.tenantId,
      executionId: input.executionId,
      providerModelKey: input.providerModelKey,
      inputTokens: input.inputTokens,
      cachedInputTokens: input.cachedInputTokens,
      outputTokens: input.outputTokens,
      reasoningTokens: input.reasoningTokens,
      totalTokens: input.inputTokens + input.outputTokens
    }
  });
}

export interface CostEntryInput {
  tenantId: string;
  executionId: bigint;
  costType: 'input_tokens' | 'output_tokens';
  quantity: number;
  unitPrice: number;
  currency: string;
  pricingVersion: string;
}

export async function recordCostEntry(
  prisma: ZorflyPrismaClient,
  input: CostEntryInput
): Promise<void> {
  await prisma.aICostTracking.create({
    data: {
      tenantId: input.tenantId,
      executionId: input.executionId,
      costType: input.costType,
      quantity: input.quantity,
      unit: 'tokens',
      unitPrice: input.unitPrice,
      amount: (input.quantity / 1_000_000) * input.unitPrice,
      currency: input.currency,
      pricingVersion: input.pricingVersion
    }
  });
}

export interface GenerationDraftRecord {
  /** Stable 0-based ordinal within the execution's raw output; the upsert key alongside executionId. */
  draftIndex: number;
  request: Prisma.InputJsonValue;
  validationResult: Prisma.InputJsonValue;
}

export interface GenerationHistoryRef {
  /** Opaque public identifier (QuestionGenerationHistory.publicId) — never the internal bigint id. */
  historyId: string;
}

const historyIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ensures one QuestionGenerationHistory row exists per raw AI draft item, keyed
 * by (executionId, draftIndex). Idempotent and crash-safe: a row already
 * recorded is left untouched (preserving any human decision already made on
 * it); a row missing — because this is the first call, or because a prior
 * call was interrupted after the AI execution succeeded but before history
 * was recorded — is created. Never returns fewer refs than drafts supplied.
 */
export async function upsertGenerationDrafts(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  executionId: bigint,
  drafts: readonly GenerationDraftRecord[]
): Promise<GenerationHistoryRef[]> {
  if (drafts.length === 0) return [];
  return prisma.$transaction(async (transaction) => {
    const refs: GenerationHistoryRef[] = [];
    for (const draft of drafts) {
      const existing = await transaction.questionGenerationHistory.findUnique({
        where: { executionId_draftIndex: { executionId, draftIndex: draft.draftIndex } },
        select: { publicId: true }
      });
      if (existing) {
        refs.push({ historyId: existing.publicId });
        continue;
      }
      const created = await transaction.questionGenerationHistory.create({
        data: {
          tenantId,
          executionId,
          draftIndex: draft.draftIndex,
          request: draft.request,
          validationResult: draft.validationResult
        },
        select: { publicId: true }
      });
      refs.push({ historyId: created.publicId });
    }
    return refs;
  });
}

export interface LinkGenerationDecisionInput {
  tenantId: string;
  historyId: string;
  generatedQuestionVersionId: string;
  decidedById: string;
}

/**
 * Tenant-scoped: links a saved question version back to the AI draft that
 * produced it, inside the caller's question-creation transaction so the
 * provenance link and the saved question commit or roll back together.
 *
 * Throws ApiError(422) for a malformed, unknown, or cross-tenant history id,
 * and ApiError(409) if that draft was already redeemed by an earlier save —
 * a history id is single-use, and a duplicate redemption is rejected rather
 * than silently re-linked or transparently returning the earlier question.
 */
export async function linkGenerationDecision(
  transaction: Prisma.TransactionClient,
  input: LinkGenerationDecisionInput
): Promise<void> {
  if (!historyIdPattern.test(input.historyId)) {
    throw new ApiError(422, 'The AI draft reference is invalid.', { historyId: 'Invalid value.' });
  }
  const history = await transaction.questionGenerationHistory.findUnique({
    where: { publicId: input.historyId }
  });
  if (!history || history.tenantId !== input.tenantId) {
    throw new ApiError(422, 'The AI draft reference was not found.', {
      historyId: 'Invalid value.'
    });
  }
  if (history.humanDecision !== null) {
    throw new ApiError(409, 'This AI-generated draft has already been saved.', {
      historyId: 'Already saved.'
    });
  }
  await transaction.questionGenerationHistory.update({
    where: { id: history.id },
    data: {
      humanDecision: 'accepted',
      generatedQuestionVersionId: input.generatedQuestionVersionId,
      decidedById: input.decidedById,
      decidedAt: new Date()
    }
  });
}

export interface AppendLogInput {
  tenantId: string;
  executionId: bigint;
  sequence: number;
  level: 'info' | 'warn' | 'error';
  eventType: string;
  message?: string;
  attributes?: Prisma.InputJsonValue;
}

export async function appendLog(prisma: ZorflyPrismaClient, input: AppendLogInput): Promise<void> {
  await prisma.aIPromptLog.create({
    data: {
      tenantId: input.tenantId,
      executionId: input.executionId,
      sequence: input.sequence,
      level: input.level,
      eventType: input.eventType,
      ...(input.message ? { message: input.message } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes } : {})
    }
  });
}
