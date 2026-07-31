import type { SessionPrincipal } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: SessionPrincipal;
    }
  }
}

export {};
