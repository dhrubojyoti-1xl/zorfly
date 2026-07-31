import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from './api-error.js';

export class HttpProblem extends Error {
  public constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
    public readonly type = 'about:blank'
  ) {
    super(message);
    this.name = 'HttpProblem';
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new HttpProblem(
      404,
      'Not Found',
      `No resource exists at ${request.method} ${request.originalUrl}.`
    )
  );
};

export const problemHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {})
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    response.status(409).json({
      success: false,
      message: 'A record with the same value already exists.'
    });
    return;
  }

  const problem =
    error instanceof HttpProblem
      ? error
      : new HttpProblem(500, 'Internal Server Error', 'The request could not be completed.');

  if (!(error instanceof HttpProblem)) {
    request.log.error({ error }, 'Unhandled request error');
  }

  response.status(problem.status).type('application/problem+json').json({
    type: problem.type,
    title: problem.title,
    status: problem.status,
    detail: problem.message,
    instance: request.originalUrl,
    requestId: request.id
  });
};
