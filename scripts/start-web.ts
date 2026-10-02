import "./server-only-cli.cjs";

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Starts the standalone Next server only after the runtime role and migrations are checked. */
async function main(): Promise<void> {
  const { assertRuntimeDatabaseRole } = await import("@/db/client");

  // 1. Wait for database connection with retries
  let retries = 0;
  const maxRetries = 15;
  while (true) {
    try {
      await assertRuntimeDatabaseRole();
      break;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        process.stderr.write(`Failed to connect to database after ${maxRetries} attempts.\n`);
        throw error;
      }
      process.stderr.write(`Waiting for database (attempt ${retries}/${maxRetries}): ${String(error)}\n`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 2. Automatically apply database migrations
  if (process.env.AUTO_MIGRATE !== "false") {
    try {
      process.stdout.write("Applying Prisma database migrations...\n");
      const prismaBin = resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
      const schemaPath = resolve(process.cwd(), "db", "schema.prisma");
      if (existsSync(prismaBin) && existsSync(schemaPath)) {
        execSync(`node "${prismaBin}" migrate deploy --schema "${schemaPath}"`, {
          stdio: "inherit",
          env: process.env,
        });
        process.stdout.write("Database migrations applied successfully.\n");
      }
    } catch (migErr) {
      process.stderr.write(`Database migration warning: ${String(migErr)}\n`);
    }

    try {
      const bossBin = resolve(process.cwd(), "node_modules", "pg-boss", "dist", "cli.js");
      if (existsSync(bossBin)) {
        execSync(`node "${bossBin}" migrate --schema guardian_jobs`, {
          stdio: "inherit",
          env: process.env,
        });
      }
    } catch (bossErr) {
      process.stderr.write(`pg-boss migration notice: ${String(bossErr)}\n`);
    }
  }

  // 3. Auto-bootstrap / update admin credentials if configured
  if (process.env.GUARDIAN_ADMIN_EMAIL && process.env.GUARDIAN_ADMIN_PASSWORD) {
    try {
      process.stdout.write("Ensuring administrator account...\n");
      const bootstrapScript = resolve(process.cwd(), "scripts", "bootstrap-admin.ts");
      const tsxBin = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
      const cliWrapper = resolve(process.cwd(), "scripts", "server-only-cli.cjs");
      if (existsSync(bootstrapScript) && existsSync(tsxBin)) {
        execSync(`node --require "${cliWrapper}" "${tsxBin}" "${bootstrapScript}"`, {
          stdio: "inherit",
          env: process.env,
        });
      }
    } catch (bootErr) {
      process.stderr.write(`Admin bootstrap notice: ${String(bootErr)}\n`);
    }
  }

  // 4. Start standalone server
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

