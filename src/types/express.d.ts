import type { UserDoc } from '../models/User.model';

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export {};
