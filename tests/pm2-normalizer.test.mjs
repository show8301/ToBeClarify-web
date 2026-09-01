import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const normalizerPath = fileURLToPath(
  new URL("../scripts/normalize-pm2-jlist.cjs", import.meta.url),
);

const withFixture = async (content, callback) => {
  const root = await mkdtemp(join(tmpdir(), "pm2-normalizer-"));
  const fixturePath = join(root, "jlist.txt");
  try {
    await writeFile(fixturePath, content, "utf8");
    return await callback(fixturePath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("normalizes noisy PM2 output with Windows case-duplicate environment keys", async () => {
  const fixture = `[PM2] daemon message\n${JSON.stringify([
    {
      name: "tobeclarify-web-dev",
      pm2_env: {
        pm_cwd: "D:\\www_root\\ToBeClarify_web_dev",
        pm_exec_path: "D:\\www_root\\ToBeClarify_web_dev\\node_modules\\vinext\\dist\\cli.js",
        args: ["start", "--port", "4310"],
        status: "online",
        env: { username: "lower", USERNAME: "upper" },
      },
    },
  ])}\n`;

  await withFixture(fixture, async (fixturePath) => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      normalizerPath,
      fixturePath,
      "tobeclarify-web-dev",
    ]);
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), {
      name: "tobeclarify-web-dev",
      pm2_env: {
        pm_cwd: "D:\\www_root\\ToBeClarify_web_dev",
        pm_exec_path: "D:\\www_root\\ToBeClarify_web_dev\\node_modules\\vinext\\dist\\cli.js",
        args: ["start", "--port", "4310"],
        status: "online",
      },
    });
  });
});

test("returns an empty projection for a missing application", async () => {
  await withFixture("[]", async (fixturePath) => {
    const { stdout } = await execFileAsync(process.execPath, [
      normalizerPath,
      fixturePath,
      "tobeclarify-web-prod",
    ]);
    assert.equal(JSON.parse(stdout), null);
  });
});

test("rejects duplicate PM2 applications with the same name", async () => {
  const duplicateApp = {
    name: "probe",
    pm2_env: { status: "online" },
  };

  await withFixture(JSON.stringify([duplicateApp, duplicateApp]), async (fixturePath) => {
    await assert.rejects(
      execFileAsync(process.execPath, [normalizerPath, fixturePath, "probe"]),
      (error) => {
        assert.notEqual(error.code, 0);
        assert.match(error.stderr, /more than one application named probe/);
        return true;
      },
    );
  });
});

test("rejects unreadable PM2 output with a non-zero exit code", async () => {
  await withFixture("not-json", async (fixturePath) => {
    await assert.rejects(
      execFileAsync(process.execPath, [normalizerPath, fixturePath, "probe"]),
      (error) => {
        assert.notEqual(error.code, 0);
        assert.match(error.stderr, /does not contain a JSON process list/);
        return true;
      },
    );
  });
});
