import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readRepositoryFile = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("the shared workflow deploys only dev and main to isolated targets", async () => {
  const workflow = await readRepositoryFile(".github/workflows/deploy.yml");

  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/dev'/);

  assert.match(workflow, /PROD_DEPLOY_PATH: \$\{\{ vars\.WEB_DEPLOY_PATH \}\}/);
  assert.match(workflow, /PROD_HEALTH_CHECK_URL: \$\{\{ vars\.WEB_HEALTHCHECK_URL \}\}/);
  assert.match(workflow, /DEV_DEPLOY_PATH: \$\{\{ vars\.DEV_WEB_DEPLOY_PATH \}\}/);
  assert.match(workflow, /DEV_HEALTH_CHECK_URL: \$\{\{ vars\.DEV_WEB_HEALTHCHECK_URL \}\}/);
  assert.match(workflow, /DEV_PUBLIC_CLIENT_API_BASE_URL: \$\{\{ vars\.DEV_PUBLIC_CLIENT_API_BASE_URL \}\}/);
  assert.match(workflow, /DEV_ORDERING_API_BASE_URL: \$\{\{ vars\.DEV_ORDERING_API_BASE_URL \}\}/);
  assert.match(workflow, /PROD_PUBLIC_CLIENT_API_BASE_URL: \$\{\{ vars\.WEB_PUBLIC_CLIENT_API_BASE_URL \}\}/);
  assert.match(workflow, /PROD_ORDERING_API_BASE_URL: \$\{\{ vars\.WEB_ORDERING_API_BASE_URL \}\}/);

  assert.doesNotMatch(workflow, /vars\.(?:DEV_NODE_PORT|WEB_NODE_PORT)/);
  assert.doesNotMatch(workflow, /vars\.(?:DEV_NODE_TASK_NAME|WEB_NODE_TASK_NAME)/);
  assert.match(workflow, /group: vinext-iis-deployment/);
  assert.match(workflow, /SIBLING_HEALTH_CHECK_URL/);
  assert.match(workflow, /Validate isolated PM2 watchdog on Windows/);
  assert.match(workflow, /test-vinext-pm2-runtime\.ps1 -SmokeTest/);
  assert.match(workflow, /scripts\/native-command\.ps1/);
  assert.match(workflow, /scripts\/resurrect-vinext-pm2\.ps1/);
});

test("development deployment skips automated test suites", async () => {
  const workflow = await readRepositoryFile(".github/workflows/deploy.yml");

  assert.doesNotMatch(workflow, /run:\s*npm run test(?::|\s)/i);
  assert.doesNotMatch(workflow, /run:\s*(?:npm|pnpm|yarn|npx|node)\s+[^\r\n]*(?:test|playwright|cypress|selenium)/i);
});

test("production promotion only accepts the tested dev branch", async () => {
  const workflow = await readRepositoryFile(".github/workflows/deploy.yml");

  assert.match(workflow, /validate-production-promotion/);
  assert.match(workflow, /github\.base_ref == 'main'/);
  assert.match(workflow, /HEAD_REF: \$\{\{ github\.head_ref \}\}/);
  assert.match(workflow, /HEAD_REF.*!= "dev"/);
});

test("the IIS deployer derives immutable identities for both environments", async () => {
  const deployScript = await readRepositoryFile("scripts/deploy-vinext-iis.ps1");

  assert.match(deployScript, /\[ValidateSet\('production', 'development'\)\]/);
  assert.match(deployScript, /DeployLeaf = 'ToBeClarify_web'/);
  assert.match(deployScript, /NodePort = 4300/);
  assert.match(deployScript, /Pm2AppName = 'tobeclarify-web-prod'/);
  assert.match(deployScript, /LegacyTaskName = 'ToBeClarify Vinext PROD'/);
  assert.match(deployScript, /DeployLeaf = 'ToBeClarify_web_dev'/);
  assert.match(deployScript, /NodePort = 4310/);
  assert.match(deployScript, /Pm2AppName = 'tobeclarify-web-dev'/);
  assert.match(deployScript, /LegacyTaskName = 'ToBeClarify Vinext DEV'/);
  assert.doesNotMatch(deployScript, /\[int\]\$NodePort/);
  assert.doesNotMatch(deployScript, /\[string\]\$Pm2AppName/);
  assert.match(deployScript, /function Rename-DirectoryWithRetry/);
  assert.match(deployScript, /function Assert-Pm2AppIdentity/);
  assert.match(deployScript, /function Assert-LegacyVinextTaskIdentity/);
  assert.match(deployScript, /\$Pm2Home = 'D:\\pm2\\ToBeClarify-web'/);
  assert.match(deployScript, /startOrRestart/);
  assert.match(deployScript, /Save-Pm2ProcessList/);
  assert.match(deployScript, /Register-Pm2StartupTask/);
  assert.match(deployScript, /-ExpectedDeploymentSha \$DeploymentSha/);
  assert.match(deployScript, /Protected sibling verified before deployment/);
  assert.match(deployScript, /Protected sibling remained healthy/);
  assert.match(deployScript, /\$runtimeConfig\.PUBLIC_CLIENT_API_BASE_URL/);
  assert.match(deployScript, /\$runtimeConfig\.ORDERING_API_BASE_URL/);
});

test("the PM2 process is isolated from file watching and runner cleanup", async () => {
  const deployScript = await readRepositoryFile("scripts/deploy-vinext-iis.ps1");

  assert.match(deployScript, /autorestart = \$true/);
  assert.match(deployScript, /watch = \$false/);
  assert.match(deployScript, /instances = 1/);
  assert.match(deployScript, /exec_mode = 'fork'/);
  assert.match(deployScript, /Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue/);
});

test("deployment never targets every PM2 process and keeps legacy rollback", async () => {
  const deployScript = await readRepositoryFile("scripts/deploy-vinext-iis.ps1");

  assert.doesNotMatch(deployScript, /pm2[^\r\n]*(?:delete|stop|restart|reload|kill)\s+all/i);
  assert.doesNotMatch(deployScript, /Invoke-Pm2[^\r\n]+@\([^\r\n]*['"]all['"]/i);
  assert.match(deployScript, /Stop-Pm2App -Name \$Pm2AppName/);
  assert.match(deployScript, /Start-ScheduledTask -TaskName \$LegacyTaskName/);
  assert.match(deployScript, /Rollback also failed/);
  assert.match(deployScript, /Rollback verified for deployment SHA/);
});

test("PM2 inspection avoids the Windows jlist JSON collision path", async () => {
  const deployScript = await readRepositoryFile("scripts/deploy-vinext-iis.ps1");
  const runtimeTest = await readRepositoryFile("scripts/test-vinext-pm2-runtime.ps1");

  assert.doesNotMatch(deployScript, /\bjlist\b/);
  assert.match(deployScript, /@\('pid', \$Name\)/);
  assert.match(deployScript, /Get-CimInstance -ClassName Win32_Process/);
  assert.match(deployScript, /protected port \$Port belongs to PID \$listenerPid/);
  assert.match(runtimeTest, /Stop-Process -Id \$firstPid/);
  assert.match(runtimeTest, /PM2 did not restart the intentionally terminated smoke process/);
});

test("native stderr is captured safely under Windows PowerShell 5.1", async () => {
  const nativeHelper = await readRepositoryFile("scripts/native-command.ps1");

  assert.match(nativeHelper, /\$previousErrorActionPreference = \$ErrorActionPreference/);
  assert.match(nativeHelper, /\$ErrorActionPreference = 'Continue'/);
  assert.match(nativeHelper, /@\(& \$FilePath @ArgumentList 2>&1\)/);
  assert.match(nativeHelper, /\$commandExitCode = \$LASTEXITCODE/);
  assert.match(nativeHelper, /\$global:LASTEXITCODE = \$previousLastExitCode/);
  assert.match(nativeHelper, /function Resolve-Pm2Command/);
  assert.match(nativeHelper, /Get-Command pm2\.cmd/);
  assert.match(nativeHelper, /D:\\pm2\\ToBeClarify-web\\cli\\node_modules\\\.bin\\pm2\.cmd/);
});
