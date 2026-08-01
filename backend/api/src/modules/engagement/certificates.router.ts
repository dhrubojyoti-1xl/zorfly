import { Router, type Request } from 'express';
import { z } from 'zod';
import { MembershipStatus, type ZorflyPrismaClient } from '@zorfly/database';
import { roles } from '../../domain/access-control.js';
import { ApiError } from '../../platform/api-error.js';
import { createRequireAuth, createRequirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

const uuid = z.uuid();

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

async function activeMembership(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: MembershipStatus.ACTIVE, deletedAt: null }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

function snapshotOf(value: unknown): { title: string; employeeName: string; percentage: number } {
  const object =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    title: typeof object.title === 'string' ? object.title : 'Assessment',
    employeeName: typeof object.employeeName === 'string' ? object.employeeName : '',
    percentage: typeof object.percentage === 'number' ? object.percentage : 0
  };
}

export function createCertificateRouter(
  prisma: ZorflyPrismaClient,
  service: AuthService,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));
  router.use(createRequirePermission(service, 'certificates:read'));

  router.get('/mine', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const rows = await prisma.certificate.findMany({
      where: { tenantId: auth.tenantId, membershipId: membership.id },
      orderBy: { issuedAt: 'desc' }
    });
    response.json({
      success: true,
      data: {
        rows: rows.map((certificate) => {
          const snapshot = snapshotOf(certificate.snapshot);
          return {
            id: certificate.id,
            title: snapshot.title,
            percentage: snapshot.percentage,
            serial: certificate.verificationCode,
            issuedAt: certificate.issuedAt
          };
        }),
        totalCount: rows.length
      }
    });
  });

  router.get('/:id', async (request, response) => {
    const auth = principal(request);
    const id = uuid.parse(request.params.id);
    const restrictToOwn = auth.role === roles.employee || auth.role === roles.teamLeader;
    const membership = restrictToOwn
      ? await activeMembership(prisma, auth.tenantId, auth.userId)
      : null;
    const certificate = await prisma.certificate.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        ...(membership ? { membershipId: membership.id } : {})
      }
    });
    if (!certificate) throw new ApiError(404, 'The requested certificate was not found.');
    const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
    const snapshot = snapshotOf(certificate.snapshot);
    response.json({
      success: true,
      data: {
        id: certificate.id,
        title: snapshot.title,
        employeeName: snapshot.employeeName,
        percentage: snapshot.percentage,
        serial: certificate.verificationCode,
        issuedAt: certificate.issuedAt,
        companyName: tenant?.name ?? '',
        companyLogoUrl: ''
      }
    });
  });

  return router;
}
