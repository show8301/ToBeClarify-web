# Repository instructions

## Environment definitions

- Web test environment is the `dev` branch and deploys to `https://www-dev.marchgroup.net`.
- Web production environment is the `main` branch; promote only after the test deployment is confirmed.
- The API project has no separate test environment. When a combined request says to deploy to the test environment, deploy Web to `dev` and deploy the API through its normal production flow to `main`.
- API `dev` is build-only and is not an API test host.

## Coding standards

- Read and follow [`docs/coding-standards.md`](docs/coding-standards.md) before making Web code changes.
- New source code uses TypeScript/TSX. Existing JavaScript/JSX may be migrated incrementally when materially edited.
- Cross-domain runtime implementation imports are forbidden; type-only imports from explicit contract modules are allowed.
- Browser code uses same-origin `/api/...` clients; upstream API origins belong only in `lib/server/upstream-config.ts`.

## Development deployment checks

- Skip all automated test suites for a `dev` branch deployment by default, including unit, component, integration, E2E, and browser tests. Run them only when the user explicitly requests testing for that run.
- Keep the `dev` CI path limited to the application build, static/configuration validation, deployment status, and the existing operational HTTP health check.
- Keep test scripts available for manual or explicitly requested execution; they must not be invoked by the `dev` deployment workflow.

## Web promotion flow

- All Web code and configuration changes go to `dev` before production. Pushing `dev` deploys the change to `https://www-dev.marchgroup.net` for user verification.
- Do not promote a feature branch directly to `main`. After the user confirms the development deployment, open the production pull request from `dev` to `main` and merge it manually.
- A `main` push is a production release and must not be used to test an unconfirmed change. Production deployment is therefore gated by the user's confirmation and the manual `dev` → `main` promotion.
