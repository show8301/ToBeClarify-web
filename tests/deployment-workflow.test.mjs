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
  assert.match(deployScript, /TaskName = 'ToBeClarify Vinext PROD'/);
  assert.match(deployScript, /DeployLeaf = 'ToBeClarify_web_dev'/);
  assert.match(deployScript, /NodePort = 4310/);
  assert.match(deployScript, /TaskName = 'ToBeClarify Vinext DEV'/);
  assert.doesNotMatch(deployScript, /\[int\]\$NodePort/);
  assert.doesNotMatch(deployScript, /\[string\]\$TaskName/);
  assert.match(deployScript, /function Rename-DirectoryWithRetry/);
  assert.match(deployScript, /function Assert-VinextTaskIdentity/);
  assert.match(deployScript, /-AllowMissing \| Out-Null/);
  assert.match(deployScript, /-ExpectedDeploymentSha \$DeploymentSha/);
  assert.match(deployScript, /Protected sibling verified before deployment/);
  assert.match(deployScript, /Protected sibling remained healthy/);
  assert.match(deployScript, /\$runtimeConfig\.PUBLIC_CLIENT_API_BASE_URL/);
  assert.match(deployScript, /\$runtimeConfig\.ORDERING_API_BASE_URL/);
});

test("the scheduled Vinext process survives GitHub runner cleanup", async () => {
  const launcher = await readRepositoryFile("scripts/start-vinext.ps1");

  assert.match(
    launcher,
    /\$env:RUNNER_TRACKING_ID = "tobeclarify-vinext-\$Port"[\s\S]*Remove-Item Env:RUNNER_TRACKING_ID -ErrorAction SilentlyContinue/,
  );
});
