export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message);
export const forbidden = (message = 'You do not have access to this resource') => new AppError(403, message);
export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
