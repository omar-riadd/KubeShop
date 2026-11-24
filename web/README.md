# KubeShop Web Storefront

React 19 storefront Single Page Application (SPA) for KubeShop ("Gear for engineers"), featuring a live platform status and canary rollout demo dashboard (`/status`).

## Features

- **Storefront**: Product catalog with search, category filtering, product details, cart with optimistic updates, accessible checkout form with client & server validation, order confirmation, and order history.
- **Instant `Cmd+K` Command Palette**: Global quick search activated via `Cmd+K`, `Ctrl+K`, `/`, or header search trigger with category filtering pills, live catalog querying, and keyboard navigation (`↑`/`↓`/`Enter`).
- **Slide-Out Mini-Cart Drawer**: Slide-over cart drawer with real-time dynamic Free Priority SRE Dispatch progress bar ($75 threshold), inline item quantity controls, delete confirmations, and direct checkout CTA.
- **Floating Sticky Quick-Buy**: High-converting floating action bar that slides into view when scrolling past the main buy action on product detail pages.
- **Technical Hardware Unboxing ("What's in the Box")**: Category-tailored spec grids detailing cables, adapters, tools, extra switches, and manuals.
- **Side-by-Side Spec Comparison**: Apple Store-style modal comparison matrix evaluating form factors, switch types, connectivity, polling rates, and dimensions.
- **Frequently Bought Together Bundles**: Complementary product pairings with real-time subtotal calculation and an automatic 10% bundle discount.
- **Platform Status & Rollout Observer (`/status`)**: Live canary rollout observer measuring service health, response latency, active pod names, and real-time version traffic distributions.
- **Theme**: Light, Dark, and System modes persisted to `localStorage["kubeshop.theme"]` with synchronous `<script src="/theme-init.js">` in `<head>` to prevent Flash of Unstyled Content (FOUC) under strict Content Security Policy.
- **Accessibility**: Built with semantic landmarks, keyboard navigation, visible focus indicators, screen reader live regions, and verified zero WCAG 2.1 AA violations via `@axe-core/playwright`.
- **Production Container**: Multi-stage Dockerfile based on `nginxinc/nginx-unprivileged` running as non-root user `101`, `readOnlyRootFilesystem: true`, dynamic `/tmp/runtime-config.json` entrypoint, modular DRY security headers (`include /etc/nginx/security_headers.conf`), and strict CSP (`script-src 'self'`).

## Tech Stack

- **Framework**: React 19 + TypeScript (strict) + Vite
- **Routing**: React Router v7 (`BrowserRouter`) with route-level `React.lazy` + `Suspense` code splitting and vendor manual chunks (`32.58 kB` entry chunk)
- **Server State & Forms**: TanStack Query v5, React Hook Form + Zod v4
- **Styling**: Tailwind CSS v4 + Design tokens (`tokens.css`) + `lucide-react` icons
- **Fonts**: Self-hosted `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`
- **Testing**: Vitest + Testing Library (component & unit test suites across all components & pages; 53/53 tests passing across 15 suites), Playwright + `@axe-core/playwright` (15/15 E2E & WCAG 2.1 AA tests passing)
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

## Mock Mode (MSW)

For frontend-only development without Docker or Go backends running, enable Mock Service Worker:

```bash
VITE_USE_MOCKS=true pnpm dev
```

MSW handlers in `src/mocks/` serve the exact 12 seed products from the Shared Contract. The `mockServiceWorker.js` file is excluded from production `dist/` builds and verified in CI.

## Project Structure

```
web/
├── Dockerfile & nginx/           # Unprivileged Nginx (:8080), strict CSP, /tmp emptyDir
├── docker-entrypoint.d/          # 40-runtime-config.sh entrypoint generator
├── public/                       # Static product SVGs, favicon, synchronous theme-init.js
├── src/
│   ├── api/                      # Fetch client, session ID, OpenAPI generated schema.d.ts, hooks
│   ├── components/
│   │   ├── cart/                 # CartDrawer, CartDrawer item list
│   │   ├── layout/               # Header (with Cmd+K trigger), Footer, Layout, ErrorBoundary
│   │   ├── product/              # StickyQuickBuy, WhatsInTheBox, SpecComparisonModal, BundleOffer
│   │   ├── search/               # CommandPalette modal, search inputs, result listings
│   │   └── ui/                   # Design tokens: Button, Badge, Card, Dialog, Toast, Stepper, etc.
│   ├── context/                  # CartDrawerContext, SearchContext
│   ├── lib/                      # Currency formatting, shipping threshold calculator, UUID, theme
│   ├── mocks/                    # MSW fixtures and handlers (dev/unit test only)
│   ├── pages/                    # Catalog, Product, Cart, Checkout, Orders, Order, Status, NotFound
│   └── styles/                   # Tailwind v4 + CSS variable design tokens
└── e2e/                          # Playwright E2E + Axe WCAG 2.1 AA accessibility specs
```
