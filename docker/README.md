# Local service topology

`docker/compose.yml` starts the infrastructure contracts required by Zorfly:

- PostgreSQL on `localhost:5432`;
- Redis on `localhost:6379`;
- MinIO API on `localhost:9000` and console on `localhost:9001`;
- Mailpit SMTP on `localhost:1025` and web inbox on `localhost:8025`.

Run `pnpm services:up` after copying `.env.example` to `.env`. Application
processes run through `pnpm dev` so hot reload remains fast. The service
containers store data in named volumes; `pnpm services:down` does not delete
those volumes.

The API, worker, and web Dockerfiles are portable production image contracts.
They contain no cloud-provider SDK assumptions and run as non-root users where
the runtime permits.
