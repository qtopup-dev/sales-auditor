import { Request, Response, NextFunction } from 'express';

// Global Express error handler — MUST have exactly 4 parameters for Express to recognize it
// Express 5: async errors in route handlers are automatically forwarded here without .catch(next)
// Response shape (Claude's discretion): { error: string, message: string }
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[error]', err.stack ?? err.message);

  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const errorCode = (err as Error & { code?: string }).code ?? 'INTERNAL_ERROR';

  res.status(statusCode).json({
    error: errorCode,
    // In production: never expose internal error messages to clients
    message:
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
