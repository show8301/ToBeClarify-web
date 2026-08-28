# Vinext DEV deployment on IIS

The DEV site runs as a Node.js process on localhost. IIS terminates the public
HTTP(S) connection and reverse-proxies every request to that process.

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

Required repository variables:

- `DEV_WEB_DEPLOY_PATH` — `D:\www_root\ToBeClarify_web_dev`
- `DEV_WEB_HEALTHCHECK_URL` — public DEV origin, for example
  `https://www-dev.marchgroup.net`

Optional repository variables:

- `DEV_NODE_PORT` — defaults to `4310`
- `DEV_NODE_TASK_NAME` — defaults to `ToBeClarify Vinext DEV`
- `DEV_ADMIN_API_BASE_URL` — defaults in application code when omitted
- `DEV_PUBLIC_MEDIA_BASE_URL` — defaults in application code when omitted

## Workflow behavior

- Pull requests targeting `dev` perform a clean locked install, build, and test.
- Pushes to `dev` perform the same validation and then deploy automatically.
- A manual run with `preflight_only` checks the runner and IIS without changing
  the deployed site.
- Deployment uses a staging directory, retains one rollback directory, starts
  Vinext through a scheduled task, and rolls back automatically when either the
  localhost or public health check does not report the current Git commit SHA.
