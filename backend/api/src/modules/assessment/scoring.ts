export interface ScorableQuestion {
  id: string;
  categoryId: string | null;
  subCategoryId: string | null;
  type: string;
  marks: number;
  negativeMarks: number;
  content: unknown;
}

export interface QuestionScore {
  obtained: number;
  max: number;
  attempted: boolean;
  fullMarks: boolean;
  pendingReview?: boolean;
  suggestedObtained?: number;
  detection?: { found: number; total: number };
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          typeof item === 'object' && item !== null && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clamp(value: number): number {
  return value <= 0 ? 0 : Math.round(value * 100) / 100;
}

function stringSet(value: unknown): Set<string> {
  return new Set(strings(value));
}

function empty(question: ScorableQuestion, detectionTotal?: number): QuestionScore {
  return {
    obtained: 0,
    max: question.marks,
    attempted: false,
    fullMarks: false,
    ...(detectionTotal === undefined ? {} : { detection: { found: 0, total: detectionTotal } })
  };
}

function scoreMcq(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const answer = object(rawAnswer);
  const selected = stringSet(answer.selectedIds);
  if (selected.size === 0) return empty(question);
  const correct = stringSet(content.correctOptionIds);
  const multiple = content.multiple === true;
  if (!multiple) {
    const right = selected.size === 1 && correct.has([...selected][0] ?? '');
    return {
      obtained: right ? question.marks : clamp(-question.negativeMarks),
      max: question.marks,
      attempted: true,
      fullMarks: right
    };
  }
  const valid = new Set(objects(content.options).map((option) => text(option.id)));
  let correctSelected = 0;
  let wrongSelected = 0;
  for (const id of selected) {
    if (!valid.has(id)) continue;
    if (correct.has(id)) correctSelected += 1;
    else wrongSelected += 1;
  }
  if (content.partialCredit !== true) {
    const perfect = correctSelected === correct.size && wrongSelected === 0;
    return {
      obtained: perfect ? question.marks : clamp(-question.negativeMarks),
      max: question.marks,
      attempted: true,
      fullMarks: perfect
    };
  }
  const fraction =
    correct.size > 0 ? Math.max(0, (correctSelected - wrongSelected) / correct.size) : 0;
  const obtained = clamp(
    question.marks * fraction - (wrongSelected > 0 ? question.negativeMarks : 0)
  );
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: obtained >= question.marks
  };
}

function scoreTrueFalse(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const answer = object(rawAnswer);
  if (answer.value === undefined || answer.value === null) return empty(question);
  const right = Boolean(answer.value) === Boolean(object(question.content).correctAnswer);
  return {
    obtained: right ? question.marks : clamp(-question.negativeMarks),
    max: question.marks,
    attempted: true,
    fullMarks: right
  };
}

function scoreImageComparison(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const answer = object(rawAnswer);
  const legacyChoice = text(answer.choice);
  const choice =
    text(answer.choiceId) || (legacyChoice === 'A' ? 'a' : legacyChoice === 'B' ? 'b' : '');
  if (!choice) return empty(question);
  const legacyCorrect = text(content.correctImage);
  const correct =
    text(content.correctImageId) ||
    (legacyCorrect === 'A' ? 'a' : legacyCorrect === 'B' ? 'b' : '');
  const right = choice === correct;
  return {
    obtained: right ? question.marks : clamp(-question.negativeMarks),
    max: question.marks,
    attempted: true,
    fullMarks: right
  };
}

function scoreFindMistakes(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const answer = object(rawAnswer);
  const mistakes = objects(content.mistakes);
  if (content.mode === 'typed') {
    const lines = strings(answer.typedAnswers)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return empty(question, mistakes.length);
    const normalized = lines.map((line) => line.toLowerCase());
    const matched = mistakes.filter((mistake) => {
      const label = text(mistake.label).toLowerCase();
      return normalized.some((line) => line.includes(label) || label.includes(line));
    }).length;
    return {
      obtained: 0,
      max: question.marks,
      attempted: true,
      fullMarks: false,
      pendingReview: true,
      suggestedObtained:
        mistakes.length > 0
          ? Math.round((question.marks / mistakes.length) * matched * 100) / 100
          : 0,
      detection: { found: 0, total: mistakes.length }
    };
  }
  const selected = stringSet(answer.selectedIds);
  if (selected.size === 0) return empty(question, mistakes.length);
  const mistakeIds = new Set(mistakes.map((mistake) => text(mistake.id)));
  let found = 0;
  let wrong = 0;
  for (const id of selected) {
    if (mistakeIds.has(id)) found += 1;
    else wrong += 1;
  }
  const obtained = clamp(
    (mistakes.length > 0 ? question.marks / mistakes.length : 0) * found -
      question.negativeMarks * wrong
  );
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: found === mistakes.length && wrong === 0,
    detection: { found, total: mistakes.length }
  };
}

function inside(click: JsonObject, zone: JsonObject, tolerance: number): boolean {
  const x = number(click.x);
  const y = number(click.y);
  const zoneX = number(zone.x);
  const zoneY = number(zone.y);
  return (
    x >= zoneX - tolerance &&
    x <= zoneX + number(zone.w) + tolerance &&
    y >= zoneY - tolerance &&
    y <= zoneY + number(zone.h) + tolerance
  );
}

function scoreHotspot(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const zones = objects(content.zones);
  const clicks = objects(object(rawAnswer).clicks);
  if (clicks.length === 0) return empty(question, zones.length);
  const tolerance = number(content.tolerancePct, 2) / 100;
  const foundZones = zones.map(() => false);
  let wrong = 0;
  for (const click of clicks) {
    const index = zones.findIndex(
      (zone, candidate) => !foundZones[candidate] && inside(click, zone, tolerance)
    );
    if (index >= 0) foundZones[index] = true;
    else if (!zones.some((zone) => inside(click, zone, tolerance))) wrong += 1;
  }
  const found = foundZones.filter(Boolean).length;
  const earned = zones.reduce(
    (sum, zone, index) =>
      sum +
      (foundZones[index]
        ? number(zone.marks, zones.length > 0 ? question.marks / zones.length : 0)
        : 0),
    0
  );
  const obtained = clamp(earned - question.negativeMarks * wrong);
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: found === zones.length && wrong === 0,
    detection: { found, total: zones.length }
  };
}

function scoreContentReview(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const errors = objects(object(question.content).errors);
  const selected = new Set(numbers(object(rawAnswer).selectedWordIndexes));
  if (selected.size === 0) return empty(question, errors.length);
  const expected = new Set(errors.map((error) => number(error.wordIndex, -1)));
  let found = 0;
  let wrong = 0;
  for (const index of selected) {
    if (expected.has(index)) found += 1;
    else wrong += 1;
  }
  const obtained = clamp(
    (errors.length > 0 ? question.marks / errors.length : 0) * found -
      question.negativeMarks * wrong
  );
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: found === errors.length && wrong === 0,
    detection: { found, total: errors.length }
  };
}

function scoreVideoReview(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const mistakes = objects(content.mistakes);
  const claims = objects(object(rawAnswer).marks).map((mark) => number(mark.timestampSec));
  if (claims.length === 0) return empty(question, mistakes.length);
  const tolerance = number(content.toleranceSec, 2);
  const claimUsed = claims.map(() => false);
  const foundMistakes = mistakes.map(() => false);
  mistakes.forEach((mistake, index) => {
    const target = number(mistake.timestampSec);
    let best = -1;
    let distance = Number.POSITIVE_INFINITY;
    claims.forEach((claim, claimIndex) => {
      const candidate = Math.abs(claim - target);
      if (!claimUsed[claimIndex] && candidate <= tolerance && candidate < distance) {
        best = claimIndex;
        distance = candidate;
      }
    });
    if (best >= 0) {
      claimUsed[best] = true;
      foundMistakes[index] = true;
    }
  });
  const found = foundMistakes.filter(Boolean).length;
  const wrong = claimUsed.filter((used) => !used).length;
  const earned = mistakes.reduce(
    (sum, mistake, index) =>
      sum +
      (foundMistakes[index]
        ? number(mistake.marks, mistakes.length > 0 ? question.marks / mistakes.length : 0)
        : 0),
    0
  );
  const obtained = clamp(earned - question.negativeMarks * wrong);
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: found === mistakes.length && wrong === 0,
    detection: { found, total: mistakes.length }
  };
}

function scoreDragDrop(question: ScorableQuestion, rawAnswer: unknown): QuestionScore {
  const content = object(question.content);
  const answer = object(rawAnswer);
  if (content.mode === 'sequence') {
    const order = strings(answer.order);
    const target = strings(content.correctOrder);
    if (order.length === 0) return empty(question);
    const correct = target.filter((id, index) => order[index] === id).length;
    const perfect = correct === target.length;
    const obtained =
      content.partialCredit === false
        ? perfect
          ? question.marks
          : 0
        : clamp(target.length > 0 ? (question.marks * correct) / target.length : 0);
    return {
      obtained,
      max: question.marks,
      attempted: true,
      fullMarks: perfect
    };
  }
  const pairs = objects(answer.pairs);
  const expectedPairs = objects(content.correctPairs);
  if (pairs.length === 0) return empty(question);
  const expected = new Map(expectedPairs.map((pair) => [text(pair.leftId), text(pair.rightId)]));
  const seen = new Set<string>();
  let correct = 0;
  for (const pair of pairs) {
    const left = text(pair.leftId);
    if (seen.has(left)) continue;
    seen.add(left);
    if (expected.get(left) === text(pair.rightId)) correct += 1;
  }
  const perfect = correct === expectedPairs.length;
  const obtained =
    content.partialCredit === false
      ? perfect
        ? question.marks
        : 0
      : clamp(expectedPairs.length > 0 ? (question.marks * correct) / expectedPairs.length : 0);
  return {
    obtained,
    max: question.marks,
    attempted: true,
    fullMarks: perfect
  };
}

export function scoreQuestion(question: ScorableQuestion, answer: unknown): QuestionScore {
  switch (question.type) {
    case 'mcq':
      return scoreMcq(question, answer);
    case 'true_false':
      return scoreTrueFalse(question, answer);
    case 'image_comparison':
      return scoreImageComparison(question, answer);
    case 'find_mistakes':
      return scoreFindMistakes(question, answer);
    case 'hotspot':
    case 'multiple_error_detection':
      return scoreHotspot(question, answer);
    case 'content_review':
      return scoreContentReview(question, answer);
    case 'video_review':
      return scoreVideoReview(question, answer);
    case 'drag_drop':
      return scoreDragDrop(question, answer);
    default:
      throw new Error(`Unknown question type: ${question.type}`);
  }
}

export function scoreAttempt(
  questions: readonly ScorableQuestion[],
  answers: Readonly<Record<string, unknown>>
) {
  let obtained = 0;
  let maximum = 0;
  let attempted = 0;
  let fullMarks = 0;
  let detectionFound = 0;
  let detectionTotal = 0;
  let pendingReviewCount = 0;
  const perQuestion: Array<QuestionScore & { questionId: string }> = [];
  const categories = new Map<string, { obtained: number; max: number }>();
  for (const question of questions) {
    const result = scoreQuestion(question, answers[question.id]);
    obtained += result.obtained;
    maximum += result.max;
    if (result.attempted) attempted += 1;
    if (result.fullMarks) fullMarks += 1;
    if (result.pendingReview) pendingReviewCount += 1;
    if (result.detection) {
      detectionFound += result.detection.found;
      detectionTotal += result.detection.total;
    }
    perQuestion.push({ questionId: question.id, ...result });
    const category = question.categoryId ?? 'uncategorised';
    const total = categories.get(category) ?? { obtained: 0, max: 0 };
    total.obtained += result.obtained;
    total.max += result.max;
    categories.set(category, total);
  }
  obtained = Math.round(obtained * 100) / 100;
  return {
    obtained,
    max: maximum,
    percentage: maximum > 0 ? Math.round((obtained / maximum) * 10_000) / 100 : 0,
    accuracy: attempted > 0 ? Math.round((fullMarks / attempted) * 10_000) / 100 : 0,
    detectionRate:
      detectionTotal > 0 ? Math.round((detectionFound / detectionTotal) * 10_000) / 100 : null,
    attemptedCount: attempted,
    pendingReviewCount,
    perQuestion,
    perCategory: [...categories].map(([categoryId, total]) => ({
      categoryId,
      obtained: Math.round(total.obtained * 100) / 100,
      max: total.max,
      percentage: total.max > 0 ? Math.round((total.obtained / total.max) * 10_000) / 100 : 0
    }))
  };
}
