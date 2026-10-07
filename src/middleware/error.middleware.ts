import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (typeof err === 'object' && err && 'code' in err && err.code === 11000) {
    const fields = Object.keys((err as { keyValue?: object }).keyValue ?? {}).join(', ');
    return res.status(409).json({ success: false, message: `Duplicate value for ${fields || 'a unique field'}` });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: env.isProd ? 'Something went wrong' : (err as Error)?.message ?? 'Unknown error',
  });
};
