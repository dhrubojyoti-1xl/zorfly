import type { Prisma, ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import type { EvaluationResult } from './evaluation.js';

export const EVALUATION_TYPE = 'subjective_response_evaluation';

export interface RecordEvaluationInput {
  tenantId: string;
  executionId: bigint;
  attemptId: bigint;
  /** attemptQuestionId as a string, stored inside inputReference — AIEvaluationHistory has no direct FK to AttemptQuestion by design (it's a flexible JSON-referenced history table). */
  attemptQuestionId: string;
  questionId: string;
  answerHash: string;
  maxMarks: number;
  result: EvaluationResult;
}

export interface EvaluationHistoryRow {
  id: bigint;
  tenantId: string;
  executionId: bigint;
  attemptId: bigint | null;
  result: EvaluationResult;
  confidence: number | null;
  humanOutcome: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  inputReference: { attemptQuestionId: string; questionId: string; answerHash: string; maxMarks: number };
}

function toRow(row: {
  id: bigint;
  tenantId: string;
  executionId: bigint;
  attemptId: bigint | null;
  result: Prisma.JsonValue;
  confidence: Prisma.Decimal | null;
  humanOutcome: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  inputReference: Prisma.JsonValue;
}): EvaluationHistoryRow {
  const ref = (row.inputReference ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    tenantId: row.tenantId,
    executionId: row.executionId,
    attemptId: row.attemptId,
    result: row.result as unknown as EvaluationResult,
    confidence: row.confidence ? Number(row.confidence) : null,
    humanOutcome: row.humanOutcome,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    inputReference: {
      attemptQuestionId: typeof ref.attemptQuestionId === 'string' ? ref.attemptQuestionId : '',
      questionId: typeof ref.questionId === 'string' ? ref.questionId : '',
      answerHash: typeof ref.answerHash === 'string' ? ref.answerHash : '',
      maxMarks: typeof ref.maxMarks === 'number' ? ref.maxMarks : 0
    }
  };
}

/** Records one immutable AIEvaluationHistory row for this execution. An execution is 1:1 with an idempotency key, so a retried request that reused the execution never creates a second row (callers check findLatestEvaluationForExecution first). */
export async function recordEvaluation(
  prisma: ZorflyPrismaClient,
  input: RecordEvaluationInput
): Promise<EvaluationHistoryRow> {
  const created = await prisma.aIEvaluationHistory.create({
    data: {
      tenantId: input.tenantId,
      executionId: input.executionId,
      attemptId: input.attemptId,
      evaluationType: EVALUATION_TYPE,
      inputReference: {
        attemptQuestionId: input.attemptQuestionId,
        questionId: input.questionId,
        answerHash: input.answerHash,
        maxMarks: input.maxMarks
      } as Prisma.InputJsonValue,
      result: input.result as unknown as Prisma.InputJsonValue,
      confidence: input.result.confidence
    }
  });
  return toRow(created);
}

/** Returns the AIEvaluationHistory row already recorded for this execution, if any — used to make evaluation-triggering idempotent without relying on inputReference JSON lookups. */
export async function findEvaluationByExecution(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  executionId: bigint
): Promise<EvaluationHistoryRow | null> {
  const row = await prisma.aIEvaluationHistory.findFirst({
    where: { tenantId, executionId }
  });
  return row ? toRow(row) : null;
}

/**
 * Finds the latest AIEvaluationHistory row for a specific attempt question.
 * AIEvaluationHistory has no direct foreign key to AttemptQuestion (by
 * schema design, evaluationType/inputReference are meant to stay flexible),
 * so this scans the small set of evaluations for the attempt and filters in
 * memory — an attempt has at most a handful of questions, so this stays
 * cheap without needing a JSONB path index.
 */
export async function findLatestEvaluationForQuestion(
  prisma: ZorflyPrismaClient,
  tenantId: string,
  attemptId: bigint,
  attemptQuestionId: string
): Promise<EvaluationHistoryRow | null> {
  const rows = await prisma.aIEvaluationHistory.findMany({
    where: { tenantId, attemptId },
    orderBy: { createdAt: 'desc' }
  });
  for (const row of rows) {
    const parsed = toRow(row);
    if (parsed.inputReference.attemptQuestionId === attemptQuestionId) return parsed;
  }
  return null;
}

export type EvaluationDecision = 'accepted' | 'adjusted' | 'rejected';

/**
 * Records the human reviewer's final decision on an AI evaluation. The
 * evaluation row itself (result/confidence/inputReference) is never
 * mutated — only humanOutcome/reviewedById/reviewedAt are set, and only
 * once: a second decision attempt is rejected rather than silently
 * overwriting the audit trail.
 */
export async function recordEvaluationDecision(
  prisma: ZorflyPrismaClient,
  input: { id: bigint; tenantId: string; decision: EvaluationDecision; reviewedById: string }
): Promise<void> {
  const existing = await prisma.aIEvaluationHistory.findFirst({
    where: { id: input.id, tenantId: input.tenantId }
  });
  if (!existing) throw new ApiError(404, 'The requested AI evaluation was not found.');
  if (existing.humanOutcome !== null) {
    throw new ApiError(409, 'This AI evaluation already has a recorded human decision.');
  }
  await prisma.aIEvaluationHistory.update({
    where: { id: input.id },
    data: {
      humanOutcome: input.decision,
      reviewedById: input.reviewedById,
      reviewedAt: new Date()
    }
  });
}
