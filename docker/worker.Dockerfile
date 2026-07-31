FROM node:24.14.1-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY backend/worker backend/worker
COPY packages/config packages/config
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zorfly/worker... build
RUN pnpm deploy --filter @zorfly/worker --prod /runtime

FROM node:24.14.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S zorfly && adduser -S -G zorfly zorfly
COPY --from=build --chown=zorfly:zorfly /runtime ./
USER zorfly
CMD ["node", "dist/src/main.js"]
