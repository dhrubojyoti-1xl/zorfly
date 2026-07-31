import { describe, expect, it } from 'vitest';
import { questionSchema } from '../src/modules/assessment/question.validation.js';

const base = {
  title: 'A production question',
  categoryId: '10000000-0000-4000-8000-000000000001',
  difficulty: 'junior',
  marks: 10
} as const;

describe('OneXL question validation compatibility', () => {
  it('rejects an MCQ answer that is not present in the options', () => {
    const result = questionSchema.safeParse({
      ...base,
      type: 'mcq',
      content: {
        options: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' }
        ],
        correctOptionIds: ['c']
      }
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Correct options must be from the options list.'
      );
    }
  });

  it('accepts normalized hotspot coordinates and applies tolerance defaults', () => {
    const result = questionSchema.parse({
      ...base,
      type: 'hotspot',
      content: {
        imageUrl: 'https://example.com/image.png',
        zones: [{ id: 'z1', label: 'Issue', x: 0.1, y: 0.2, w: 0.3, h: 0.4 }]
      }
    });
    expect(result.content).toMatchObject({ tolerancePct: 2 });
  });

  it('requires sequence answers to contain every item exactly once', () => {
    const result = questionSchema.safeParse({
      ...base,
      type: 'drag_drop',
      content: {
        mode: 'sequence',
        items: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' }
        ],
        correctOrder: ['a', 'a']
      }
    });
    expect(result.success).toBe(false);
  });
});
