const fs = require("node:fs");

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

if (process.argv.length !== 4) {
  fail("Usage: node normalize-pm2-jlist.cjs <pm2-output-file> <app-name>");
}

const [, , inputPath, appName] = process.argv;

try {
  const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "").trim();
  const processListStart = raw.match(/\[\s*(?:\{|\])/);
  const arrayStart = processListStart?.index ?? -1;
  const arrayEnd = raw.lastIndexOf("]");

  if (arrayStart < 0 || arrayEnd < arrayStart) {
    fail("PM2 output does not contain a JSON process list.");
  }

  const apps = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
  if (!Array.isArray(apps)) {
    fail("PM2 process list is not a JSON array.");
  }

  const matches = apps
    .filter((app) => app && app.name === appName)
    .map((app) => ({
      name: app.name,
      pm2_env: {
        pm_cwd: app.pm2_env?.pm_cwd ?? null,
        pm_exec_path: app.pm2_env?.pm_exec_path ?? null,
        args: Array.isArray(app.pm2_env?.args) ? app.pm2_env.args : [],
        status: app.pm2_env?.status ?? null,
      },
    }));

  if (matches.length > 1) {
    fail(`PM2 contains more than one application named ${appName}.`);
  }

  process.stdout.write(JSON.stringify(matches[0] ?? null));
} catch (error) {
  fail(`Unable to normalize PM2 process list: ${error.message}`);
}
