export class ApiError extends Error {
  public readonly isOperational = true;

  public constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
