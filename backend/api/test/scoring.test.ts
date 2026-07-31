import { describe, expect, it } from 'vitest';
import { scoreQuestion, type ScorableQuestion } from '../src/modules/assessment/scoring.js';

function question(type: string, content: unknown, marks = 10, negativeMarks = 0): ScorableQuestion {
  return {
    id: 'question',
    categoryId: null,
    subCategoryId: null,
    type,
    marks,
    negativeMarks,
    content
  };
}

describe('deterministic OneXL scoring', () => {
  it('scores partial-credit MCQs and penalizes an incorrect claim', () => {
    const result = scoreQuestion(
      question(
        'mcq',
        {
          options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
          correctOptionIds: ['a', 'b'],
          multiple: true,
          partialCredit: true
        },
        10,
        1
      ),
      { selectedIds: ['a', 'c'] }
    );
    expect(result.obtained).toBe(0);
  });

  it('scores normalized hotspot coordinates with tolerance and unique zones', () => {
    const result = scoreQuestion(
      question('hotspot', {
        imageUrl: '/image.png',
        tolerancePct: 2,
        zones: [
          { id: 'one', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
          { id: 'two', x: 0.6, y: 0.6, w: 0.2, h: 0.2 }
        ]
      }),
      {
        clicks: [
          { x: 0.11, y: 0.11 },
          { x: 0.61, y: 0.61 }
        ]
      }
    );
    expect(result).toMatchObject({
      obtained: 10,
      fullMarks: true,
      detection: { found: 2, total: 2 }
    });
  });

  it('routes typed mistake answers to manual review with a suggestion', () => {
    const result = scoreQuestion(
      question('find_mistakes', {
        mode: 'typed',
        mistakes: [
          { id: 'one', label: 'wrong colour' },
          { id: 'two', label: 'missing logo' }
        ]
      }),
      { typedAnswers: ['missing logo'] }
    );
    expect(result).toMatchObject({
      obtained: 0,
      attempted: true,
      pendingReview: true,
      suggestedObtained: 5
    });
  });

  it('matches video claims once using the configured tolerance', () => {
    const result = scoreQuestion(
      question('video_review', {
        toleranceSec: 2,
        mistakes: [
          { id: 'one', timestampSec: 10 },
          { id: 'two', timestampSec: 20 }
        ]
      }),
      { marks: [{ timestampSec: 11 }, { timestampSec: 21 }] }
    );
    expect(result.obtained).toBe(10);
    expect(result.fullMarks).toBe(true);
  });

  it('awards drag-and-drop sequence partial credit deterministically', () => {
    const result = scoreQuestion(
      question('drag_drop', {
        mode: 'sequence',
        correctOrder: ['a', 'b', 'c'],
        partialCredit: true
      }),
      { order: ['a', 'c', 'b'] }
    );
    expect(result.obtained).toBe(3.33);
  });
});
