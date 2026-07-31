FROM node:24.14.1-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY frontend/web frontend/web
COPY packages/contracts packages/contracts
RUN pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @zorfly/web... build

FROM nginxinc/nginx-unprivileged:1.28.0-alpine AS runtime
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/web/dist /usr/share/nginx/html
EXPOSE 8080
