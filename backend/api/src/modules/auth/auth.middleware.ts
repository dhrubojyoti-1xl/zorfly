import type { RequestHandler } from 'express';
import { ApiError } from '../../platform/api-error.js';
import { runWithRequestContext } from '../../platform/request-context.js';
import type { TokenService } from './tokens.js';
import type { AuthService } from './auth.service.js';

export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.headers.authorization ?? '';
    const rawToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!rawToken) {
      next(new ApiError(401, 'Authentication is required.'));
      return;
    }

    try {
      request.auth = tokens.verifyAccessToken(rawToken);
    } catch {
      next(new ApiError(401, 'Your session has expired. Please log in again.'));
      return;
    }

    if (request.auth.impersonatorId && request.method === 'DELETE') {
      next(new ApiError(403, 'Delete actions are not allowed while impersonating a user.'));
      return;
    }

    const requestId =
      typeof request.id === 'string' || typeof request.id === 'number'
        ? String(request.id)
        : undefined;
    runWithRequestContext(
      {
        ...request.auth,
        ...(requestId ? { requestId } : {})
      },
      next
    );
  };
}

export function requireRole(...allowedRoles: string[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new ApiError(401, 'Authentication is required.'));
      return;
    }
    if (!allowedRoles.includes(request.auth.role)) {
      next(new ApiError(403, 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}

export function createRequirePermission(service: AuthService, ...needed: string[]): RequestHandler {
  return async (request, _response, next) => {
    if (!request.auth) {
      next(new ApiError(401, 'Authentication is required.'));
      return;
    }
    if (await service.hasAnyPermission(request.auth, needed)) {
      next();
      return;
    }
    next(new ApiError(403, 'You do not have permission to perform this action.'));
  };
}
