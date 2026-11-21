# KubeShop Web Storefront

React 19 storefront Single Page Application (SPA) for KubeShop ("Gear for engineers"), featuring a live platform status and canary rollout demo dashboard (`/status`).

## Features

- **Storefront**: Product catalog with search, category filtering, product details, cart with optimistic updates, accessible checkout form with client & server validation, order confirmation, and order history.
- **Platform Status & Rollout Observer (`/status`)**: Live canary rollout observer measuring service health, response latency, active pod names, and real-time version traffic distributions.
- **Theme**: Light, Dark, and System modes persisted to `localStorage["kubeshop.theme"]` with synchronous `<script src="/theme-init.js">` in `<head>` to prevent Flash of Unstyled Content (FOUC) under strict Content Security Policy.
- **Accessibility**: Built with semantic landmarks, keyboard navigation, visible focus indicators, screen reader live regions, and verified zero WCAG 2.1 AA violations via `@axe-core/playwright`.
- **Production Container**: Multi-stage Dockerfile based on `nginxinc/nginx-unprivileged` running as non-root user `101`, `readOnlyRootFilesystem: true`, dynamic `/tmp/runtime-config.json` entrypoint, and strict CSP (`script-src 'self'`).

## Tech Stack

- **Framework**: React 19 + TypeScript (strict) + Vite
- **Routing**: React Router (library mode, `BrowserRouter`)
- **Server State**: TanStack Query v5
- **Styling**: Tailwind CSS v4 + Design tokens (`tokens.css`) + `lucide-react` icons
- **Fonts**: Self-hosted `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`
- **Testing**: Vitest + Testing Library, Playwright + `@axe-core/playwright`
- **Mocks**: Mock Service Worker (MSW) for offline unit testing

## Scripts

```bash
pnpm install           # Install dependencies
pnpm dev               # Start Vite dev server on http://localhost:5173 (proxies /api to local Go backends)
pnpm test              # Run unit tests via Vitest
pnpm test:coverage     # Run unit tests with coverage
pnpm build             # Production build (TypeScript typecheck + Vite build to dist/)
pnpm test:e2e          # Run Playwright E2E and Axe accessibility suite
pnpm gen:api           # Regenerate TypeScript API types from api/openapi.yaml
```

## Environment & Runtime Configuration

The web application talks to the same origin (`/api/...`) with relative URLs only (no CORS).

In production, container environment variables `APP_ENV`, `APP_VERSION`, `APP_GIT_SHA`, and `APP_BUILD_TIME` are written to `/tmp/runtime-config.json` by `docker-entrypoint.d/40-runtime-config.sh` on container boot and fetched by the frontend on mount.
