import { createHash } from 'node:crypto';
import {
  AiGateway,
  AiProviderError,
  type AiGatewayEvent,
  type AiGatewayPolicy
} from '@zorfly/ai-core';
import { AIExecutionStatus, type Prisma, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import {
  appendLog,
  completeExecutionFailure,
  completeExecutionSuccess,
  createExecution,
  recordCostEntry,
  recordTokenUsage,
  resolveExecutionPlan,
  sumCostSince,
  type ResolvedModelConfiguration
} from './ai.repository.js';
import { buildProviderAdapter } from './provider-factory.js';
import type { SecretResolver } from './secret-resolver.js';
import type { HttpTransport } from './providers/http-transport.js';
import type { GenerateExecutionInput, GenerateExecutionResult } from './ai.types.js';

export interface AiExecutionServiceOptions {
  prisma: ZorflyPrismaClient;
  secretResolver: SecretResolver;
  transport?: HttpTransport;
  gatewayPolicy?: Partial<AiGatewayPolicy>;
}

function startOfDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function logLevel(event: AiGatewayEvent): 'info' | 'warn' | 'error' {
  if (event.type === 'failed') return 'error';
  if (event.type === 'retrying' || event.type === 'failed_over') return 'warn';
  return 'info';
}

export class AiExecutionService {
  private readonly prisma: ZorflyPrismaClient;
  private readonly secretResolver: SecretResolver;
  private readonly transport: HttpTransport | undefined;
  private readonly gatewayPolicy: Partial<AiGatewayPolicy> | undefined;

  public constructor(options: AiExecutionServiceOptions) {
    this.prisma = options.prisma;
    this.secretResolver = options.secretResolver;
    this.transport = options.transport;
    this.gatewayPolicy = options.gatewayPolicy;
  }

  private async eligibleConfigurations(
    tenantId: string,
    plan: readonly ResolvedModelConfiguration[]
  ): Promise<ResolvedModelConfiguration[]> {
    const eligible: ResolvedModelConfiguration[] = [];
    for (const config of plan) {
      if (config.dailyBudget !== null) {
        const spent = await sumCostSince(
          this.prisma,
          tenantId,
          config.configurationId,
          startOfDay()
        );
        if (spent >= config.dailyBudget) continue;
      }
      if (config.monthlyBudget !== null) {
        const spent = await sumCostSince(
          this.prisma,
          tenantId,
          config.configurationId,
          startOfMonth()
        );
        if (spent >= config.monthlyBudget) continue;
      }
      eligible.push(config);
    }
    return eligible;
  }

  public async generate<TOutput = unknown>(
    input: GenerateExecutionInput<TOutput>
  ): Promise<GenerateExecutionResult<TOutput>> {
    const plan = await resolveExecutionPlan(this.prisma, input.tenantId, input.configurationKey);
    if (plan.length === 0) {
      throw new ApiError(422, 'AI is not configured for this tenant and purpose.');
    }

    const eligible = await this.eligibleConfigurations(input.tenantId, plan);

    const inputSnapshot = {
      capability: input.capability,
      messages: input.messages,
      ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {})
    };
    const inputHash = createHash('sha256').update(JSON.stringify(inputSnapshot)).digest('hex');

    if (eligible.length === 0) {
      const created = await createExecution(this.prisma, {
        tenantId: input.tenantId,
        modelConfigurationId: plan[0]!.configurationId,
        purpose: input.purpose,
        idempotencyKey: input.idempotencyKey,
        inputHash,
        inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonValue,
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
        ...(input.sourceId ? { sourceId: input.sourceId } : {})
      });
      if (!created.reused) {
        await completeExecutionFailure(this.prisma, {
          executionId: created.id,
          status: AIExecutionStatus.BLOCKED,
          failureCode: 'budget_exhausted'
        });
      }
      throw new ApiError(429, 'The AI budget for this capability has been exhausted.');
    }

    const created = await createExecution(this.prisma, {
      tenantId: input.tenantId,
      modelConfigurationId: eligible[0]!.configurationId,
      purpose: input.purpose,
      idempotencyKey: input.idempotencyKey,
      inputHash,
      inputSnapshot: inputSnapshot as unknown as Prisma.InputJsonValue,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.sourceId ? { sourceId: input.sourceId } : {})
    });

    if (created.reused) {
      if (created.status === AIExecutionStatus.SUCCEEDED) {
        return {
          executionId: created.id,
          executionPublicId: created.publicId,
          output: created.outputSnapshot as TOutput,
          providerKey: eligible[0]!.providerKey,
          modelKey: eligible[0]!.modelKey,
          reused: true
        };
      }
      if (
        created.status === AIExecutionStatus.FAILED ||
        created.status === AIExecutionStatus.BLOCKED
      ) {
        throw new ApiError(
          409,
          'A previous AI request with this idempotency key did not succeed. Retry with a new idempotency key.'
        );
      }
      throw new ApiError(409, 'This AI request is already in progress.');
    }

    const adapters = await Promise.all(
      eligible.map(async (config) => {
        const apiKey = await this.secretResolver.resolve(config.secretReference);
        return buildProviderAdapter({
          providerKey: config.providerKey,
          modelKey: config.modelKey,
          apiKey,
          ...(this.transport ? { transport: this.transport } : {})
        });
      })
    );

    const events: AiGatewayEvent[] = [];
    const gateway = new AiGateway({
      adapters,
      ...(this.gatewayPolicy ? { policy: this.gatewayPolicy } : {}),
      onEvent: (event) => events.push(event)
    });

    try {
      const response = await gateway.generate({
        capability: input.capability,
        messages: input.messages,
        ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
        ...(input.validateOutput ? { validateOutput: input.validateOutput } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
        idempotencyKey: input.idempotencyKey
      });

      await this.persistLogs(input.tenantId, created.id, events);
      await completeExecutionSuccess(this.prisma, {
        executionId: created.id,
        outputSnapshot: response.output as Prisma.InputJsonValue,
        ...(response.providerRequestId ? { providerRequestId: response.providerRequestId } : {}),
        latencyMs: response.latencyMs
      });
      await recordTokenUsage(this.prisma, {
        tenantId: input.tenantId,
        executionId: created.id,
        providerModelKey: response.modelKey,
        inputTokens: response.usage.inputTokens,
        cachedInputTokens: response.usage.cachedInputTokens,
        outputTokens: response.usage.outputTokens,
        reasoningTokens: response.usage.reasoningTokens
      });
      const usedConfig =
        eligible.find((config) => config.providerKey === response.providerKey) ?? eligible[0]!;
      await this.recordCost(input.tenantId, created.id, usedConfig, response.usage);

      return {
        executionId: created.id,
        executionPublicId: created.publicId,
        output: response.output,
        providerKey: response.providerKey,
        modelKey: response.modelKey,
        reused: false
      };
    } catch (error) {
      await this.persistLogs(input.tenantId, created.id, events);
      const providerError =
        error instanceof AiProviderError
          ? error
          : new AiProviderError('The AI request failed.', 'unknown', false);
      await completeExecutionFailure(this.prisma, {
        executionId: created.id,
        status: AIExecutionStatus.FAILED,
        failureCode: providerError.category,
        failureDetail: { message: providerError.message } as Prisma.InputJsonValue
      });
      throw new ApiError(502, providerError.message);
    }
  }

  private async persistLogs(
    tenantId: string,
    executionId: bigint,
    events: readonly AiGatewayEvent[]
  ): Promise<void> {
    let sequence = 0;
    for (const event of events) {
      sequence += 1;
      await appendLog(this.prisma, {
        tenantId,
        executionId,
        sequence,
        level: logLevel(event),
        eventType: event.type,
        attributes: {
          providerKey: event.providerKey,
          modelKey: event.modelKey,
          attempt: event.attempt,
          ...(event.category ? { category: event.category } : {}),
          ...(event.latencyMs !== undefined ? { latencyMs: event.latencyMs } : {})
        } as Prisma.InputJsonValue
      });
    }
  }

  private async recordCost(
    tenantId: string,
    executionId: bigint,
    config: ResolvedModelConfiguration,
    usage: { inputTokens: number; outputTokens: number }
  ): Promise<void> {
    const pricingVersion = 'catalog-v1';
    const currency = 'USD';
    if (config.inputPricePerMillion !== null) {
      await recordCostEntry(this.prisma, {
        tenantId,
        executionId,
        costType: 'input_tokens',
        quantity: usage.inputTokens,
        unitPrice: config.inputPricePerMillion,
        currency,
        pricingVersion
      });
    }
    if (config.outputPricePerMillion !== null) {
      await recordCostEntry(this.prisma, {
        tenantId,
        executionId,
        costType: 'output_tokens',
        quantity: usage.outputTokens,
        unitPrice: config.outputPricePerMillion,
        currency,
        pricingVersion
      });
    }
  }
}
