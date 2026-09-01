# Vinext deployment on IIS

Both the production and DEV sites run as separate Node.js processes on
localhost. IIS terminates each public HTTP(S) connection and reverse-proxies
requests to the port assigned to that environment.

## One-time server prerequisites

- IIS Web Server, including the management tools that provide `appcmd.exe`
- Microsoft IIS URL Rewrite 2.1 (x64)
- Microsoft Application Request Routing (ARR) 3.0
- Node.js 22.13.0 or newer
- Windows PowerShell 5.1 with the `ScheduledTasks` module
- A self-hosted GitHub Actions runner whose service identity:
  - is a local administrator;
  - can register and run scheduled tasks;
  - has Modify permission on the deployment parent directory;
  - can update IIS server-level proxy configuration.

IISNode and ASP.NET are not required. ARR proxy support is enabled
idempotently by the deployment script after the preflight check confirms that
ARR is installed.

URL Rewrite can be installed from a manual workflow run by selecting
`allow_one_time_url_rewrite_install`. ARR must be installed separately on the
server before automatic deployment is enabled.

## GitHub Actions variables

Production requires:

- `WEB_DEPLOY_PATH` — production IIS physical path ending in
  `ToBeClarify_web`
- `WEB_HEALTHCHECK_URL` — production origin, for example
  `https://www.marchgroup.net`

Production optionally accepts:

- `WEB_ADMIN_API_BASE_URL` — defaults in application code when omitted
- `WEB_PUBLIC_MEDIA_BASE_URL` — defaults in application code when omitted
- `WEB_PUBLIC_CLIENT_API_BASE_URL` — defaults in application code when omitted
- `WEB_ORDERING_API_BASE_URL` — defaults in application code when omitted

Development requires:

- `DEV_WEB_DEPLOY_PATH` — `D:\www_root\ToBeClarify_web_dev`
- `DEV_WEB_HEALTHCHECK_URL` — public DEV origin, for example
  `https://www-dev.marchgroup.net`

Development optionally accepts:

- `DEV_ADMIN_API_BASE_URL` — defaults in application code when omitted
- `DEV_PUBLIC_MEDIA_BASE_URL` — defaults in application code when omitted
- `DEV_PUBLIC_CLIENT_API_BASE_URL` — defaults in application code when omitted
- `DEV_ORDERING_API_BASE_URL` — defaults in application code when omitted

The deployment identity is intentionally not configurable through repository
variables. Production always uses port `4300` and Scheduled Task
`ToBeClarify Vinext PROD`; development always uses port `4310` and Scheduled
Task `ToBeClarify Vinext DEV`.

## Workflow behavior

- Pull requests targeting `dev` perform a clean locked install, build, and
  static/deployment validation without deploying. Automated test suites are
  intentionally skipped unless the user explicitly requests a test run.
- The only permitted production promotion pull request is `dev` → `main`.
  The workflow rejects a different source branch for a pull request targeting
  `main`, so feature branches cannot bypass the development environment.
- Pushes to `dev` deploy automatically to the development environment. This is
  the required first release for every Web change and must be manually checked
  by the user.
- Only after the user confirms the DEV result should the tested `dev` commit be
  manually merged into `main`; that push then deploys to the production
  environment.
- Production and DEV use different IIS directories, fixed Node ports, fixed
  Scheduled Task names, and GitHub environments. A shared deployment
  concurrency group serializes changes on the common IIS host.
- Before stopping the target, deployment requires the sibling Scheduled Task,
  localhost health endpoint, and public IIS health endpoint to agree on a live
  deployment SHA. It verifies the same sibling SHA again after deployment.
- A manual run with `preflight_only` checks the runner and IIS without changing
  the site selected by the workflow branch.
- Deployment uses a staging directory, retains one rollback directory, starts
  Vinext through a scheduled task, and rolls back automatically when either the
  localhost or public health check does not report the current Git commit SHA.

## Required Web release sequence

1. Commit the change on a `codex/*` branch and open a pull request targeting
   `dev`.
2. Merge the change into `dev` (or otherwise push the reviewed commit to
   `dev`) and wait for the DEV deployment to complete.
3. Ask the user to verify the DEV site. Keep the change out of `main` until the
   user confirms it is ready.
4. Open a new pull request from `dev` to `main` and merge it manually after the
   confirmation. The resulting `main` push triggers production deployment.
