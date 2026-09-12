# Web architecture

Updated against local Web commit `a8c5151` on 2026-09-12. This document describes ownership and data flow. [Coding standards](coding-standards.md) define the development rules; the [audit record](coding-standards-audit-20260912.md) distinguishes current implementation from remaining gaps. Workspace and repository `AGENTS.md` instructions take precedence.

## Runtime shape

The application uses React 19 with Vinext's App Router and Vite. Public pages can render from checked-in snapshots, but API routes, admin authentication, ordering proxies, dynamic staff pages, and the production Vinext server all require Node.js. IIS terminates HTTP(S) and reverse-proxies requests to the local Vinext process managed by PM2. Dependency versions and the minimum Node.js version are defined by `package.json`, `package-lock.json`, and CI.

## Ownership boundaries

### `app/`

Keep route files thin. A page may load server data, enforce route visibility, define metadata, and render a component owned by `features/`. API route handlers may translate HTTP concerns, but reusable upstream configuration belongs in `lib/server/` and reusable data access belongs in the relevant feature.

### `features/`

Each product domain owns its implementation:

- `admin/`: auth, dashboards and operations, settings, orders, rooms, duty planning, settlement, notifications, shared controls, media processing, and the admin shell.
- `ordering/`: customer ordering UI and its same-origin API client.
- `staff/`: public roster/profile components, types, and server data access.
- `rooms/`: public room catalog, availability data access, and room contracts.
- `site/`: shared public-site types and server data.
- `home/`, `gallery/`, `guestbook/`, `live-update/`, `menu/`, `rankings/`: public page components.

Feature code may import its own modules, neutral `components/` and `lib/` code, and explicit type-only contracts from another feature. Cross-feature runtime imports of components, clients, server data, state, or styles are forbidden. Route files in `app/` may compose data from several features and pass it to their components. The `admin/` subtree is one bounded context and may share its internal auth, media, and shared modules without cycles. Feature code must not import implementation files from `app/`; shared components and infrastructure must not depend on feature runtime implementations.

### `components/`

Only cross-feature presentation and interaction primitives belong here. Domain-specific components stay with their feature even if they are large.

### `lib/server/`

This directory is server-only by project convention; do not import it, or feature `server/` modules, into client dependencies. `upstream-config.ts` is the single application source for public, admin, ordering, and media API origins. Browser business requests must call same-origin `/api/...` routes. Public media URLs supplied as data may be rendered as assets. The current lint configuration does not fully enforce these import boundaries; the audit records the remaining tooling and snapshot-script differences.

## Admin routing

The App Router is the only route table. Production admin pages select entries exported by `features/admin/shell/AdminRoutes.jsx`. `AdminProviders.tsx` owns authentication, toast, image-processing, theme initialization, and notifications for authenticated users. The notification provider is keyed by user identity. `AdminRoutes.jsx` owns shared loading/error states and role guards, but it does not switch pages based on pathname. API authorization remains authoritative; preview pages are separate UI examples, not alternate authorization or transaction paths.

## Styles

The import order is part of the visual contract. These are ordered CSS files, not a guarantee of native CSS `@layer` isolation. The root layout loads public CSS, while admin and ordering add their own entries; broad selectors can therefore affect more than one area.

Public styles load in this order:

1. `00-foundation.css`
2. `10-page-layouts.css`
3. `20-theme-history.css`
4. `30-pearl-theme.css`
5. `40-refinements.css`

Admin styles load through `styles/admin/site.css` in this order:

1. `00-foundation.css`
2. `10-management.css`
3. `20-ordering.css`
4. `30-public-previews.css`
5. `40-dark-and-operational.css`
6. `50-modern.css`
7. `60-settlement.css`
8. `70-notifications.css`
9. `80-controls.css`

Some earlier declarations are still required as the base of later overrides; a file named `theme-history` is not automatically dead CSS. Remove or merge selectors only after assessing affected routes, dialogs, responsive layouts, and themes. Visual review must respect the applicable automation restrictions; it does not authorize browser tests for a dev release.

Customer ordering styles are owned by `styles/ordering/site.css`, which imports `base.css` followed by `modern.css`. Admin ordering management remains in admin styles.

## Data and API flow

- Server-rendered public pages use feature server data and fall back to `data/snapshots/` when upstream data is unavailable.
- Browser mutations and live refreshes use same-origin API routes.
- Admin and ordering browser clients call `/api/admin` and `/api/ordering`; route handlers proxy to configured upstream services.
- Notifications use their own client under `/api/admin/notifications`, with an authenticated provider managing streaming, reconnection, and browser resources. The admin proxy preserves SSE bodies rather than buffering successful streams.
- Authoritative quotes, balances, room occupancy, business dates, settlement, and status transitions belong to the API. Public snapshots cannot complete transactions or authorize access.
- Environment-specific upstream origins are optional. Defaults target the production API and are centralized in `lib/server/upstream-config.ts`.
- `/api/health` reports Web process liveness and the deployment SHA. `/api/health/dependencies` separately checks selected upstream reads; neither substitutes for user acceptance.

## Safe change workflow

1. Preserve existing local changes and branch from the current `dev` commit, using the `codex/` prefix by default.
2. Keep mechanical moves separate from behavior changes and update affected contracts and documentation.
3. Use build, typecheck, lint, and applicable static/configuration checks for code changes. Documentation-only changes need document and diff checks. For a dev release, skip all automated suites before, during, and after deployment unless the user explicitly requests testing for that run; do not add non-E2E tests as a pre-merge workaround. Separate PR and production checks follow their applicable policies.
4. Push the reviewed change to `dev`, wait for deployment, and verify deployment status and operational HTTP availability at `www-dev.marchgroup.net`.
5. Record the deployed dev commit SHA and wait for explicit user confirmation of that revision. Only then open and manually merge `dev` → `main`, containing that same accepted dev commit; later unconfirmed dev changes require renewed confirmation. Never promote a feature branch directly to Web `main`.

The API has no separate test host. A combined Web/API test-environment release sends Web to `dev` and the API through its normal production flow to `main`; API `dev` remains build/artifact-only. The independent blueprint site uses its own instructions and the workspace build/Sites validation policy.

The rollback tags created before the September 2026 restructure are `pre-refactor-dev-20260901` and `pre-refactor-main-20260901`.
