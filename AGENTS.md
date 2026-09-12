# Repository instructions

## Environment definitions

- Web test environment is the `dev` branch and deploys to `https://www-dev.marchgroup.net`.
- Web production environment is the `main` branch; promote only after the test deployment is confirmed.
- The API project has no separate test environment. When a combined request says to deploy to the test environment, deploy Web to `dev` and deploy the API through its normal production flow to `main`.
- API `dev` is build-only and is not an API test host.

## Coding standards

- Read and follow [`docs/coding-standards.md`](docs/coding-standards.md) before making Web code changes.
- [`docs/coding-standards-audit-20260912.md`](docs/coding-standards-audit-20260912.md) records the audit baseline and remaining implementation gaps; it does not assert full compliance or authorize unrelated fixes.
- New application source code uses TypeScript/TSX. Existing JavaScript/JSX may be migrated incrementally when materially edited; tooling and existing tests may retain `.mjs` and deployment scripts retain `.ps1`.
- Cross-domain runtime implementation imports are forbidden; type-only imports from explicit contract modules are allowed.
- Browser code uses same-origin `/api/...` clients; upstream API origins belong only in `lib/server/upstream-config.ts`.
- Keep routes thin, reuse the admin shell and providers, preserve API authority over permissions and transactions, and clean up asynchronous/browser resources.
- For documentation-only changes, check links, referenced paths/commands, policy consistency, and the diff. Application builds and automated suites are not required solely for documentation changes.

## Development deployment checks

- Skip all automated test suites for a `dev` branch deployment by default, including unit, component, integration, E2E, and browser tests. Run them only when the user explicitly requests testing for that run.
- Keep the `dev` CI path limited to the application build, static/configuration validation, deployment status, and the existing operational HTTP health check.
- Keep test scripts available for manual or explicitly requested execution; they must not be invoked by the `dev` deployment workflow.

## Web promotion flow

- All Web code and configuration changes go to `dev` before production. Pushing `dev` deploys the change to `https://www-dev.marchgroup.net` for user verification.
- Do not promote a feature branch directly to `main`. After the user confirms the development deployment, open the production pull request from `dev` to `main` and merge it manually.
- A `main` push is a production release and must not be used to test an unconfirmed change. Production deployment is therefore gated by the user's confirmation and the manual `dev` → `main` promotion.
