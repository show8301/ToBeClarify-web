# Repository instructions

## Development deployment checks

- Skip all automated test suites for a `dev` branch deployment by default, including unit, component, integration, E2E, and browser tests. Run them only when the user explicitly requests testing for that run.
- Keep the `dev` CI path limited to the application build, static/configuration validation, deployment status, and the existing operational HTTP health check.
- Keep test scripts available for manual or explicitly requested execution; they must not be invoked by the `dev` deployment workflow.
