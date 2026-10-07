import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../utils/AppError';

/** Validates and replaces req.body with the parsed (trimmed, defaulted) value. */
export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      throw badRequest(
        'Validation failed',
        result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      );
    }
    req.body = result.data;
    next();
  };
