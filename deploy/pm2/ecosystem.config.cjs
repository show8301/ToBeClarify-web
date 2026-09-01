const fs = require("node:fs");
const path = require("node:path");

const requireEnvironment = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required PM2 deployment environment variable: ${name}`);
  }
  return value;
};

const appName = requireEnvironment("TOBECLARIFY_PM2_APP_NAME");
const appRoot = path.resolve(requireEnvironment("TOBECLARIFY_PM2_APP_ROOT"));
const nodePath = path.resolve(requireEnvironment("TOBECLARIFY_PM2_NODE_PATH"));
const logRoot = path.resolve(requireEnvironment("TOBECLARIFY_PM2_LOG_ROOT"));
const port = Number.parseInt(requireEnvironment("TOBECLARIFY_PM2_APP_PORT"), 10);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error(`Invalid PM2 application port: ${process.env.TOBECLARIFY_PM2_APP_PORT}`);
}

const vinextCli = path.join(appRoot, "node_modules", "vinext", "dist", "cli.js");
const serverEntry = path.join(appRoot, "dist", "server", "index.js");
const runtimeConfigPath = path.join(appRoot, "runtime-config.json");

for (const requiredPath of [nodePath, vinextCli, serverEntry, runtimeConfigPath]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Required Vinext runtime file does not exist: ${requiredPath}`);
  }
}

const runtimeConfigText = fs
  .readFileSync(runtimeConfigPath, "utf8")
  .replace(/^\uFEFF/, "");
const runtimeConfig = JSON.parse(runtimeConfigText);
fs.mkdirSync(logRoot, { recursive: true });

module.exports = {
  apps: [
    {
      name: appName,
      namespace: "tobeclarify-web",
      script: vinextCli,
      args: ["start", "--port", String(port), "--hostname", "127.0.0.1"],
      cwd: appRoot,
      interpreter: nodePath,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      exp_backoff_restart_delay: 1000,
      min_uptime: "10s",
      max_restarts: 20,
      kill_timeout: 10000,
      merge_logs: true,
      time: true,
      out_file: path.join(logRoot, `${appName}.out.log`),
      error_file: path.join(logRoot, `${appName}.error.log`),
      env: {
        ...runtimeConfig,
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        WRANGLER_LOG_PATH: path.join(appRoot, "logs", "wrangler.log"),
        WRANGLER_WRITE_LOGS: "false",
        MINIFLARE_REGISTRY_PATH: path.join(appRoot, ".wrangler", "registry"),
      },
    },
  ],
};
