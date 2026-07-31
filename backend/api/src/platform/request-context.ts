import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionPrincipal } from '../modules/auth/auth.types.js';

export interface ZorflyRequestContext extends Partial<SessionPrincipal> {
  requestId?: string;
}

const requestContextStorage = new AsyncLocalStorage<ZorflyRequestContext>();

export function runWithRequestContext<T>(context: ZorflyRequestContext, callback: () => T): T {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): ZorflyRequestContext {
  return requestContextStorage.getStore() ?? {};
}
