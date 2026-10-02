import "./server-only-cli.cjs";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Starts the standalone Next server only after the runtime role is checked. */
async function main(): Promise<void> {
  const { assertRuntimeDatabaseRole } = await import("@/db/client");
  let retries = 0;
  while (true) {
    try {
      await assertRuntimeDatabaseRole();
      break;
    } catch (error) {
      retries++;
      if (retries >= 15) throw error;
      process.stderr.write(`Waiting for database (attempt ${retries}/15): ${String(error)}\n`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  const serverPath = [
    resolve(process.cwd(), "server.js"),
    resolve(process.cwd(), ".next", "standalone", "server.js"),
  ].find((candidate) => existsSync(candidate));
  if (serverPath === undefined) {
    throw new Error("Standalone Next server.js was not found. Run the production build first.");
  }
  await import(pathToFileURL(serverPath).href);
}

main().catch((error: unknown) => {
  process.stderr.write(`guardian_web_boot_error: ${String(error)}\n`);
  process.exitCode = 1;
});
