import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ApiError } from './api-error.js';

export function validate(schema: z.ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (result.success) {
      request.body = result.data;
      next();
      return;
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'form';
      errors[field] ??= issue.message;
    }
    const firstMessage = Object.values(errors)[0] ?? 'Please correct the highlighted fields.';
    next(new ApiError(422, firstMessage, errors));
  };
}
