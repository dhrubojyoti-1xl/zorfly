import type { ErrorRequestHandler, RequestHandler } from 'express';

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
