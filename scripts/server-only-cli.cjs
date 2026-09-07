/* eslint-disable @typescript-eslint/no-require-imports */

// The `server-only` package intentionally throws when bundled for a browser.
// Standalone Node entrypoints (the worker and smoke scripts) are already
// server-side, so neutralize the marker while running those commands.
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const originalLoad = Module._load;

// Standalone Node entrypoints do not load dotenv files automatically. Load the
// shared `.env` file for worker/smoke commands without overriding values
// explicitly supplied by the shell or deployment environment.
const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

Module._load = function load(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
