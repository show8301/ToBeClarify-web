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
  assert.match(workflow, /PROD_NODE_PORT[\s\S]*?'4300'/);
  assert.match(workflow, /PROD_NODE_TASK_NAME[\s\S]*?'ToBeClarify Vinext PROD'/);
  assert.match(workflow, /\$expectedDeployLeaf = 'ToBeClarify_web'/);

  assert.match(workflow, /DEV_DEPLOY_PATH: \$\{\{ vars\.DEV_WEB_DEPLOY_PATH \}\}/);
  assert.match(workflow, /DEV_HEALTH_CHECK_URL: \$\{\{ vars\.DEV_WEB_HEALTHCHECK_URL \}\}/);
  assert.match(workflow, /DEV_NODE_PORT[\s\S]*?'4310'/);
  assert.match(workflow, /DEV_NODE_TASK_NAME[\s\S]*?'ToBeClarify Vinext DEV'/);
  assert.match(workflow, /\$expectedDeployLeaf = 'ToBeClarify_web_dev'/);

  assert.match(workflow, /group: vinext-\$\{\{ github\.ref_name \}\}-iis-deployment/);
});

test("the IIS deployer accepts both protected deployment directories", async () => {
  const deployScript = await readRepositoryFile("scripts/deploy-vinext-iis.ps1");

  assert.match(
    deployScript,
    /\[ValidateSet\('ToBeClarify_web', 'ToBeClarify_web_dev'\)\]/,
  );
  assert.match(deployScript, /function Rename-DirectoryWithRetry/);
  assert.match(deployScript, /-ExpectedDeploymentSha \$DeploymentSha/);
});

test("the scheduled Vinext process survives GitHub runner cleanup", async () => {
  const launcher = await readRepositoryFile("scripts/start-vinext.ps1");

  assert.match(
    launcher,
    /\$env:RUNNER_TRACKING_ID = "tobeclarify-vinext-\$Port"[\s\S]*Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue/,
  );
});
