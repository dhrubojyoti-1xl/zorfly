import { Router, type Request } from 'express';
import { MembershipStatus, NotificationChannel, type ZorflyPrismaClient } from '@zorfly/database';
import { ApiError } from '../../platform/api-error.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import type { SessionPrincipal } from '../auth/auth.types.js';
import type { TokenService } from '../auth/tokens.js';

function principal(request: Request): SessionPrincipal & { tenantId: string } {
  if (!request.auth?.tenantId) throw new ApiError(401, 'Authentication is required.');
  return { ...request.auth, tenantId: request.auth.tenantId };
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pageQuery(request: Request) {
  const page = Math.max(1, Number.parseInt(queryString(request.query.page), 10) || 1);
  const requested = Number.parseInt(queryString(request.query.limit), 10) || 10;
  const limit = [10, 20, 50, 100].includes(requested) ? requested : 10;
  return { page, limit, skip: (page - 1) * limit };
}

function payloadOf(value: unknown): { title: string; body: string; link: string; type: string } {
  const object =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    title: typeof object.title === 'string' ? object.title : '',
    body: typeof object.body === 'string' ? object.body : '',
    link: typeof object.link === 'string' ? object.link : '',
    type: typeof object.type === 'string' ? object.type : 'general'
  };
}

async function activeMembership(prisma: ZorflyPrismaClient, tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, status: MembershipStatus.ACTIVE, deletedAt: null }
  });
  if (!membership) throw new ApiError(403, 'You are not an active member of this company.');
  return membership;
}

export function createNotificationsRouter(
  prisma: ZorflyPrismaClient,
  tokens: TokenService
): Router {
  const router = Router();
  router.use(createRequireAuth(tokens));

  router.get('/', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const { page, limit, skip } = pageQuery(request);
    const status = queryString(request.query.status);
    const search = queryString(request.query.search).trim();
    const where = {
      tenantId: auth.tenantId,
      recipientMembershipId: membership.id,
      channel: NotificationChannel.IN_APP,
      ...(status === 'unread' ? { readAt: null } : {}),
      ...(status === 'read' ? { readAt: { not: null } } : {}),
      ...(search
        ? {
            payload: {
              path: ['title'],
              string_contains: search
            }
          }
        : {})
    };
    const [rows, totalCount, unreadCount] = await prisma.$transaction([
      prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.count({
        where: {
          tenantId: auth.tenantId,
          recipientMembershipId: membership.id,
          channel: NotificationChannel.IN_APP,
          readAt: null
        }
      })
    ]);
    response.json({
      success: true,
      data: {
        rows: rows.map((row) => {
          const payload = payloadOf(row.payload);
          return {
            id: String(row.id),
            type: payload.type,
            title: payload.title,
            body: payload.body,
            link: payload.link,
            read: row.readAt !== null,
            createdAt: row.createdAt
          };
        }),
        totalCount,
        unreadCount,
        page,
        limit
      }
    });
  });

  router.patch('/read-all', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    await prisma.notificationDelivery.updateMany({
      where: {
        tenantId: auth.tenantId,
        recipientMembershipId: membership.id,
        channel: NotificationChannel.IN_APP,
        readAt: null
      },
      data: { readAt: new Date() }
    });
    response.json({ success: true, data: { message: 'All notifications marked as read.' } });
  });

  router.patch('/:id/read', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const id = BigInt(request.params.id ?? '0');
    const notification = await prisma.notificationDelivery.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        recipientMembershipId: membership.id,
        channel: NotificationChannel.IN_APP
      }
    });
    if (!notification) throw new ApiError(404, 'The requested notification was not found.');
    await prisma.notificationDelivery.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() }
    });
    response.json({ success: true, data: { message: 'Notification marked as read.' } });
  });

  router.delete('/:id', async (request, response) => {
    const auth = principal(request);
    const membership = await activeMembership(prisma, auth.tenantId, auth.userId);
    const id = BigInt(request.params.id ?? '0');
    const notification = await prisma.notificationDelivery.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        recipientMembershipId: membership.id,
        channel: NotificationChannel.IN_APP
      }
    });
    if (!notification) throw new ApiError(404, 'The requested notification was not found.');
    await prisma.notificationDelivery.delete({ where: { id: notification.id } });
    response.json({ success: true, data: { message: 'Notification deleted successfully.' } });
  });

  return router;
}
