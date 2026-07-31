import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { ApiEnvironment } from '@zorfly/config';
import { ApiError } from '../../platform/api-error.js';
import type { AuthService } from './auth.service.js';
import type { RequestContext, SessionPrincipal } from './auth.types.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  logInSchema,
  registerCompanySchema,
  resetPasswordSchema,
  selectCompanySchema,
  switchCompanySchema,
  updateProfileSchema
} from './auth.validation.js';

export const refreshCookieName = 'zorfly_refresh';

function requestContext(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];
  const requestId =
    typeof request.id === 'string' || typeof request.id === 'number'
      ? String(request.id)
      : undefined;
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    ...(requestId ? { requestId } : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {})
  };
}

function refreshCookie(request: Request): string {
  const cookies: unknown = request.cookies;
  if (!cookies || typeof cookies !== 'object') return '';
  const value = (cookies as Record<string, unknown>)[refreshCookieName];
  return typeof value === 'string' ? value : '';
}

function requirePrincipal(request: Request): SessionPrincipal {
  if (!request.auth) throw new ApiError(401, 'Authentication is required.');
  return request.auth;
}

export function refreshCookieOptions(environment: ApiEnvironment): CookieOptions {
  return {
    httpOnly: true,
    secure: environment.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: environment.REFRESH_TOKEN_TTL_SECONDS * 1000
  };
}

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  selectCompany: RequestHandler;
  switchCompany: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  updateProfile: RequestHandler;
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
  changePassword: RequestHandler;
}

export function createAuthController(
  service: AuthService,
  environment: ApiEnvironment
): AuthController {
  const sendSession = (
    response: Response,
    session: Awaited<ReturnType<AuthService['refreshSession']>>,
    statusCode = 200
  ) => {
    const { refreshToken, ...data } = session;
    response.cookie(refreshCookieName, refreshToken, refreshCookieOptions(environment));
    response.status(statusCode).json({ success: true, data });
  };

  return {
    register: async (request, response) => {
      const session = await service.registerCompany(
        registerCompanySchema.parse(request.body),
        requestContext(request)
      );
      sendSession(response, session, 201);
    },
    login: async (request, response) => {
      const result = await service.logIn(logInSchema.parse(request.body), requestContext(request));
      if (!('refreshToken' in result)) {
        response.json({ success: true, data: result });
        return;
      }
      sendSession(response, result);
    },
    selectCompany: async (request, response) => {
      sendSession(
        response,
        await service.selectCompany(
          selectCompanySchema.parse(request.body),
          requestContext(request)
        )
      );
    },
    switchCompany: async (request, response) => {
      const principal = requirePrincipal(request);
      const input = switchCompanySchema.parse(request.body);
      sendSession(
        response,
        await service.switchCompany(principal.userId, input.companyId, requestContext(request))
      );
    },
    refresh: async (request, response) => {
      sendSession(
        response,
        await service.refreshSession(refreshCookie(request), requestContext(request))
      );
    },
    logout: async (request, response) => {
      const data = await service.logOut(refreshCookie(request));
      response.clearCookie(refreshCookieName, {
        ...refreshCookieOptions(environment),
        maxAge: 0
      });
      response.json({ success: true, data });
    },
    me: async (request, response) => {
      const principal = requirePrincipal(request);
      const data = await service.me(principal);
      response.json({
        success: true,
        data: { ...data, impersonated: Boolean(principal.impersonatorId) }
      });
    },
    updateProfile: async (request, response) => {
      const principal = requirePrincipal(request);
      const data = await service.updateProfile(
        principal.userId,
        updateProfileSchema.parse(request.body),
        requestContext(request)
      );
      response.json({ success: true, data });
    },
    forgotPassword: async (request, response) => {
      const input = forgotPasswordSchema.parse(request.body);
      const data = await service.forgotPassword(input.email, requestContext(request));
      response.json({ success: true, data });
    },
    resetPassword: async (request, response) => {
      const input = resetPasswordSchema.parse(request.body);
      const data = await service.resetPassword(
        input.token,
        input.newPassword,
        requestContext(request)
      );
      response.json({ success: true, data });
    },
    changePassword: async (request, response) => {
      const input = changePasswordSchema.parse(request.body);
      const data = await service.changePassword(
        requirePrincipal(request),
        input.currentPassword,
        input.newPassword,
        requestContext(request)
      );
      response.json({ success: true, data });
    }
  };
}
