# Repository instructions

## Development deployment checks

- Never run E2E browser tests as part of a `dev` branch deployment or against the deployed development site.
- Keep the `dev` CI path limited to the application build, static checks, unit/component tests, explicitly enumerated non-E2E integration tests, and the existing HTTP health check.
- Keep browser E2E commands in a separate workflow that does not run for `refs/heads/dev` if they are added in the future.
