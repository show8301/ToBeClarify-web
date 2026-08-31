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

- `WEB_NODE_PORT` — defaults to `4300`
- `WEB_NODE_TASK_NAME` — defaults to `ToBeClarify Vinext PROD`
- `WEB_ADMIN_API_BASE_URL` — defaults in application code when omitted
- `WEB_PUBLIC_MEDIA_BASE_URL` — defaults in application code when omitted

Development requires:

- `DEV_WEB_DEPLOY_PATH` — `D:\www_root\ToBeClarify_web_dev`
- `DEV_WEB_HEALTHCHECK_URL` — public DEV origin, for example
  `https://www-dev.marchgroup.net`

Development optionally accepts:

- `DEV_NODE_PORT` — defaults to `4310`
- `DEV_NODE_TASK_NAME` — defaults to `ToBeClarify Vinext DEV`
- `DEV_ADMIN_API_BASE_URL` — defaults in application code when omitted
- `DEV_PUBLIC_MEDIA_BASE_URL` — defaults in application code when omitted

## Workflow behavior

- Pull requests targeting `main` or `dev` perform a clean locked install,
  build, and test without deploying.
- Pushes to `dev` deploy automatically to the development environment.
- Pushes to `main` deploy automatically to the production environment.
- Production and DEV use different IIS directories, Node ports, Scheduled Task
  names, deployment concurrency groups, and GitHub environments.
- A manual run with `preflight_only` checks the runner and IIS without changing
  the site selected by the workflow branch.
- Deployment uses a staging directory, retains one rollback directory, starts
  Vinext through a scheduled task, and rolls back automatically when either the
  localhost or public health check does not report the current Git commit SHA.
