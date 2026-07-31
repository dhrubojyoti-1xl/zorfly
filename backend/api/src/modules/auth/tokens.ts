import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SessionPrincipal } from './auth.types.js';

interface AccessClaims extends jwt.JwtPayload {
  sub: string;
  tenantId: string | null;
  role: string;
  impersonatorId?: string;
  type: 'access';
}

interface PreAuthClaims extends jwt.JwtPayload {
  sub: string;
  type: 'preauth';
}

export interface TokenService {
  signAccessToken(principal: SessionPrincipal): string;
  signPreAuthToken(userId: string): string;
  verifyAccessToken(token: string): SessionPrincipal;
  verifyPreAuthToken(token: string): string;
  createRefreshToken(): { raw: string; hash: string };
  hashRefreshToken(raw: string): string;
}

export interface TokenServiceOptions {
  signingKey: string;
  hashKey: string;
  accessTokenTtlSeconds: number;
}

export function createTokenService(options: TokenServiceOptions): TokenService {
  const verify = (token: string): jwt.JwtPayload => {
    const result = jwt.verify(token, options.signingKey, {
      algorithms: ['HS256'],
      issuer: 'zorfly-api',
      audience: 'zorfly-web'
    });
    if (typeof result === 'string') throw new Error('Invalid token claims.');
    return result;
  };

  const hashRefreshToken = (raw: string): string =>
    createHmac('sha256', options.hashKey).update(raw).digest('hex');

  return {
    signAccessToken(principal) {
      return jwt.sign(
        {
          tenantId: principal.tenantId,
          role: principal.role,
          ...(principal.impersonatorId ? { impersonatorId: principal.impersonatorId } : {}),
          type: 'access'
        },
        options.signingKey,
        {
          algorithm: 'HS256',
          subject: principal.userId,
          issuer: 'zorfly-api',
          audience: 'zorfly-web',
          expiresIn: options.accessTokenTtlSeconds
        }
      );
    },
    signPreAuthToken(userId) {
      return jwt.sign({ type: 'preauth' }, options.signingKey, {
        algorithm: 'HS256',
        subject: userId,
        issuer: 'zorfly-api',
        audience: 'zorfly-web',
        expiresIn: 300
      });
    },
    verifyAccessToken(token) {
      const claims = verify(token) as AccessClaims;
      if (
        claims.type !== 'access' ||
        typeof claims.sub !== 'string' ||
        typeof claims.role !== 'string'
      ) {
        throw new Error('Invalid access token.');
      }
      return {
        userId: claims.sub,
        tenantId: claims.tenantId ?? null,
        role: claims.role,
        ...(claims.impersonatorId ? { impersonatorId: claims.impersonatorId } : {})
      };
    },
    verifyPreAuthToken(token) {
      const claims = verify(token) as PreAuthClaims;
      if (claims.type !== 'preauth' || typeof claims.sub !== 'string') {
        throw new Error('Invalid pre-authentication token.');
      }
      return claims.sub;
    },
    createRefreshToken() {
      const raw = randomBytes(48).toString('base64url');
      return { raw, hash: hashRefreshToken(raw) };
    },
    hashRefreshToken
  };
}
