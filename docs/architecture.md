# Web architecture

## Runtime shape

The application uses React 19 with Vinext's App Router and Vite. Public pages can render from checked-in snapshots, but API routes, admin authentication, ordering proxies, dynamic staff pages, and the production Vinext server all require Node.js. IIS terminates HTTP(S) and reverse-proxies requests to the local Vinext process.

## Ownership boundaries

### `app/`

Keep route files thin. A page may load server data, enforce route visibility, define metadata, and render a component owned by `features/`. API route handlers may translate HTTP concerns, but reusable upstream configuration belongs in `lib/server/` and reusable data access belongs in the relevant feature.

### `features/`

Each product domain owns its implementation:

- `admin/`: auth, dashboard, settings domains, shared controls, media processing, and the admin shell.
- `ordering/`: customer ordering UI and its same-origin API client.
- `staff/`: public roster/profile components, types, and server data access.
- `site/`: shared public-site types and server data.
- `home/`, `gallery/`, `guestbook/`, `live-update/`, `menu/`, `rankings/`: public page components.

Feature code may import from `components/`, `lib/`, and other feature public modules when necessary. It must not import implementation files from `app/`.

### `components/`

Only cross-feature presentation and interaction primitives belong here. Domain-specific components stay with their feature even if they are large.

### `lib/server/`

This directory is server-only. `upstream-config.ts` is the single source for public, admin, ordering, and media API origins. Browser code should call same-origin `/api/...` routes instead of embedding production origins.

## Admin routing

The App Router is the only route table. Each `app/admin/**/page.tsx` selects one entry exported by `features/admin/shell/AdminRoutes.jsx`. `AdminProviders.tsx` owns authentication, toast, image-processing, and theme providers for the whole admin subtree. `AdminRoutes.jsx` owns shared loading/error states and role guards, but it does not switch pages based on pathname.

## Styles

The import order is part of the visual contract. Do not reorder layers casually.

Public styles load in this order:

1. `00-foundation.css`
2. `10-page-layouts.css`
3. `20-theme-history.css`
4. `30-pearl-theme.css`
5. `40-refinements.css`

Admin styles use equivalent numbered layers for foundation, management, ordering, public previews, and dark/operational refinements. Some earlier declarations are still required as the base of later overrides; a file named `theme-history` is not automatically dead CSS. Remove or merge selectors only with visual comparison across every route and dialog.

Ordering styles remain isolated in `styles/ordering/site.css`.

## Data and API flow

- Server-rendered public pages use feature server data and fall back to `data/snapshots/` when upstream data is unavailable.
- Browser mutations and live refreshes use same-origin API routes.
- Admin and ordering browser clients call `/api/admin` and `/api/ordering`; route handlers proxy to configured upstream services.
- Environment-specific upstream origins are optional. Defaults target the production API and are centralized in `lib/server/upstream-config.ts`.

## Safe change workflow

1. Branch from the current `dev` commit.
2. Keep mechanical moves separate from behavior changes.
3. Run build, lint, and non-E2E tests before merging the restructuring branch.
4. Merge into `dev` and verify the IIS test deployment.
5. Promote `dev` to `main` only after the test site is confirmed.

The rollback tags created before the September 2026 restructure are `pre-refactor-dev-20260901` and `pre-refactor-main-20260901`.
