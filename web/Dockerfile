FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate

# Copy package manifests and config
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml* ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

ARG GIT_SHA=local
ARG BUILD_TIME=unknown
ENV VITE_GIT_SHA=$GIT_SHA
ENV VITE_BUILD_TIME=$BUILD_TIME

# Build static bundle to /app/dist
RUN pnpm build

# Stage 2: Runtime unprivileged Nginx server
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

ARG GIT_SHA=local
ARG BUILD_TIME=unknown
ENV APP_GIT_SHA=$GIT_SHA
ENV APP_BUILD_TIME=$BUILD_TIME

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY --chmod=755 docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

# Copy built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

USER 101
