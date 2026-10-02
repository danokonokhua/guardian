/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Standalone CommonJS operations CLI; only sanitized reports are printed. */
// Local recovery drill. No backup bytes, credentials or customer rows are logged.
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const source = process.argv[2];
const database = process.argv[3];
if (
  !database ||
  !/^[a-zA-Z0-9_]+$/.test(database) ||
  !source ||
  !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(source)
) {
  console.error(
    "Usage: node scripts/verify-backup-restore.cjs <local-postgres-container> <database>",
  );
  process.exit(1);
}
const target = `guardian-restore-drill-${randomUUID()}`;
const started = Date.now();
let created = false;
let stage = "backup";
const docker = (args, options = {}) =>
  execFileSync("docker", args, {
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
async function main() {
  try {
    const backup = docker([
      "exec",
      source,
      "sh",
      "-c",
      'pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom --no-owner --no-acl',
      "backup-drill",
      database,
    ]);
    stage = "temporary container";
    docker([
      "run",
      "-d",
      "--name",
      target,
      "--network",
      "none",
      "--tmpfs",
      "/var/lib/postgresql/data:rw",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16",
    ]);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        docker(["exec", target, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!ready) throw Error("Restore container did not become ready");
    docker([
      "exec",
      target,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "CREATE ROLE guardian_app NOSUPERUSER NOBYPASSRLS;",
    ]);
    docker(["exec", target, "createdb", "-U", "postgres", "guardian_restore"]);
    stage = "restore";
    docker(
      [
        "exec",
        "-i",
        target,
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "guardian_restore",
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
      ],
      { input: backup },
    );
    stage = "schema verification";
    const sql = `SELECT json_build_object(
      'tables', (SELECT count(*) FROM pg_tables WHERE schemaname='public'),
      'completedMigrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
      'rlsTables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity),
      'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public'));`;
    const summary = JSON.parse(
      docker(
        [
          "exec",
          target,
          "psql",
          "-U",
          "postgres",
          "-d",
          "guardian_restore",
          "-At",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          sql,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    if (!summary.tables || !summary.completedMigrations || !summary.rlsTables || !summary.policies)
      throw Error("Required restored schema evidence missing");
    // Force reads of all restored tables without exposing customer data.
    docker([
      "exec",
      target,
      "psql",
      "-U",
      "postgres",
      "-d",
      "guardian_restore",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('SELECT count(*) FROM public.%I', t.tablename); END LOOP; END $$;`,
    ]);
    console.log(
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          source,
          database,
          restored: true,
          allPublicTablesReadable: true,
          ...summary,
          elapsedSeconds: Math.round((Date.now() - started) / 1000),
          limitations: [
            "Local logical restore only",
            "Owner/grants excluded; runtime permissions must be reprovisioned",
            "Does not verify offsite backups, recovery objectives, application login or encryption-key recovery",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const diagnostic = String(error.stderr ?? "").match(
      /(?:role|extension) "[a-zA-Z0-9_]+" (?:does not exist|is not available)/,
    )?.[0];
    const indexFailure = String(error.stderr ?? "").match(
      /could not create unique index "[a-zA-Z0-9_]+"/,
    )?.[0];
    if (indexFailure) console.error(indexFailure);
    console.error(
      `Backup restoration drill failed at ${stage}.${diagnostic ? " " + diagnostic : ""} No customer data or raw process errors were logged.`,
    );
    process.exitCode = 1;
  } finally {
    if (created) {
      try {
        docker(["rm", "-f", target]);
        console.log("Temporary restore container removed.");
      } catch {
        console.error(`Cleanup failed: remove only temporary container ${target}`);
        process.exitCode = 1;
      }
    }
  }
}
main();
