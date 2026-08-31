# Repository instructions

## Development deployment checks

- Skip all automated test suites for a `dev` branch deployment by default, including unit, component, integration, E2E, and browser tests. Run them only when the user explicitly requests testing for that run.
- Keep the `dev` CI path limited to the application build, static/configuration validation, deployment status, and the existing operational HTTP health check.
- Keep test scripts available for manual or explicitly requested execution; they must not be invoked by the `dev` deployment workflow.

## Web promotion flow

- All Web code and configuration changes go to `dev` before production. Pushing `dev` deploys the change to `https://www-dev.marchgroup.net` for user verification.
- Do not promote a feature branch directly to `main`. After the user confirms the development deployment, open the production pull request from `dev` to `main` and merge it manually.
- A `main` push is a production release and must not be used to test an unconfirmed change. Production deployment is therefore gated by the user's confirmation and the manual `dev` → `main` promotion.
