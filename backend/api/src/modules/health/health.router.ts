import { Router } from 'express';
import { healthResponseSchema } from '@zorfly/contracts';

export function createHealthRouter(version: string): Router {
  const router = Router();

  router.get('/', (request, response) => {
    const body = healthResponseSchema.parse({
      data: {
        service: 'zorfly-api',
        status: 'ok',
        version
      },
      meta: {
        requestId: request.id
      }
    });

    response.status(200).json(body);
  });

  return router;
}
