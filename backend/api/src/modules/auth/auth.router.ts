import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { ApiEnvironment } from '@zorfly/config';
import { validate } from '../../platform/validate.js';
import { createRequireAuth } from './auth.middleware.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import type { TokenService } from './tokens.js';
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

export function createAuthRouter(
  service: AuthService,
  tokens: TokenService,
  environment: ApiEnvironment
): Router {
  const router = Router();
  const controller = createAuthController(service, environment);
  const requireAuth = createRequireAuth(tokens);
  const authLimiter = rateLimit({
    windowMs: environment.LOGIN_RATE_LIMIT_WINDOW_MIN * 60 * 1000,
    limit: environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many attempts. Please try again after some time.'
    }
  });

  router.post('/register', authLimiter, validate(registerCompanySchema), controller.register);
  router.post('/login', authLimiter, validate(logInSchema), controller.login);
  router.post(
    '/select-company',
    authLimiter,
    validate(selectCompanySchema),
    controller.selectCompany
  );
  router.post(
    '/switch-company',
    requireAuth,
    validate(switchCompanySchema),
    controller.switchCompany
  );
  router.post(
    '/forgot-password',
    authLimiter,
    validate(forgotPasswordSchema),
    controller.forgotPassword
  );
  router.post(
    '/reset-password',
    authLimiter,
    validate(resetPasswordSchema),
    controller.resetPassword
  );
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);
  router.patch('/profile', requireAuth, validate(updateProfileSchema), controller.updateProfile);
  router.post(
    '/change-password',
    requireAuth,
    validate(changePasswordSchema),
    controller.changePassword
  );

  return router;
}
