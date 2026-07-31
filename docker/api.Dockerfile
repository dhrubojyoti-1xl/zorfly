FROM node:24.14.1-alpine AS build
WORKDIR /workspace
RUN apk add --no-cache g++ make python3
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY backend/api backend/api
COPY database database
COPY packages/config packages/config
COPY packages/contracts packages/contracts
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zorfly/api... build
RUN pnpm deploy --filter @zorfly/api --prod /runtime

FROM node:24.14.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S zorfly && adduser -S -G zorfly zorfly
COPY --from=build --chown=zorfly:zorfly /runtime ./
USER zorfly
EXPOSE 5000
CMD ["node", "dist/src/server.js"]
