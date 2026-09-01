# Vinext deployment on IIS

Both the production and DEV sites run as separate Node.js processes on
localhost. IIS terminates each public HTTP(S) connection and reverse-proxies
requests to the port assigned to that environment.

## One-time server prerequisites

- IIS Web Server, including the management tools that provide `appcmd.exe`
- Microsoft IIS URL Rewrite 2.1 (x64)
- Microsoft Application Request Routing (ARR) 3.0
- Node.js 22.13.0 or newer
- PM2 7.0.3 or newer installed in the shared Web runtime directory
- Windows PowerShell 5.1 with the `ScheduledTasks` module
- A self-hosted GitHub Actions runner whose service identity:
  - is a local administrator;
  - can register and run the PM2 resurrection scheduled task;
  - has Modify permission on the deployment parent directory;
  - has Modify permission on `D:\pm2\ToBeClarify-web`;
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
variables. Production always uses port `4300` and PM2 application
`tobeclarify-web-prod`; development always uses port `4310` and PM2 application
`tobeclarify-web-dev`. Both use the isolated PM2 home
`D:\pm2\ToBeClarify-web`, so Web deployments cannot operate the separate PM2
daemon that currently owns `D:\cron`.

### Install the isolated PM2 runtime

The interactive server administrator does not need to sign in as the GitHub
Actions runner account. From an elevated PowerShell window, run:

```powershell
.\scripts\install-vinext-pm2.ps1 -RunnerAccount "$env:COMPUTERNAME\show8301"
```

This installs a pinned PM2 CLI at
`D:\pm2\ToBeClarify-web\cli\node_modules\.bin\pm2.cmd` and grants the runner
account Modify permission on the isolated Web PM2 directory. The installer does
not start a PM2 daemon. The first Web deployment starts the daemon as the
`show8301` runner service account, preventing it from attaching to the
Administrator-owned `D:\cron` PM2 daemon.

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
  PM2 application names, and GitHub environments. A shared deployment
  concurrency group serializes changes on the common IIS host.
- Before stopping the target, deployment requires the sibling process manager,
  localhost health endpoint, and public IIS health endpoint to agree on a live
  deployment SHA. It verifies the same sibling SHA again after deployment.
- A manual run with `preflight_only` checks the runner and IIS without changing
  the site selected by the workflow branch.
- Deployment uses a staging directory, retains one rollback directory, starts
  Vinext through PM2 with `autorestart: true` and `watch: false`, and rolls back
  automatically when either the localhost or public health check does not
  report the current Git commit SHA.
- Every successful deployment saves the isolated Web PM2 process list. The
  `ToBeClarify PM2 Web Resurrect` startup task runs `pm2 resurrect` after a
  Windows reboot.

## Migration from the legacy Scheduled Tasks

The deployer supports a reversible transition while DEV and production are
migrated one at a time:

- A sibling environment may still run through its verified legacy Scheduled
  Task while the target moves to PM2.
- The target's legacy task is stopped only after its path and port identity are
  verified, and it is disabled only after the PM2 deployment passes both health
  checks.
- If deployment fails, the previous directory and previous process manager are
  restored automatically.
- The legacy tasks remain registered but disabled during the initial soak
  period. They can be deleted manually after both environments have remained
  stable for 24–48 hours.

## Required Web release sequence

1. Commit the change on a `codex/*` branch and open a pull request targeting
   `dev`.
2. Merge the change into `dev` (or otherwise push the reviewed commit to
   `dev`) and wait for the DEV deployment to complete.
3. Ask the user to verify the DEV site. Keep the change out of `main` until the
   user confirms it is ready.
4. Open a new pull request from `dev` to `main` and merge it manually after the
   confirmation. The resulting `main` push triggers production deployment.
