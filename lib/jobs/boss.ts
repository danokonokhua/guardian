import "server-only";

import { PgBoss } from "pg-boss";

import { serverConfig } from "@/config/server";
import { JOB_SCHEMA } from "@/lib/jobs/constants";
import { logger } from "@/lib/logger";

interface JobGlobal {
  __guardianPgBoss?: PgBoss;
}

const globalForJobs = globalThis as JobGlobal;

/**
 * Creates the single pg-boss instance used by the Guardian process.
 *
 * The job system deliberately uses DIRECT_URL when available. pg-boss owns
 * schema setup/migrations and maintains its own connection pool; a direct
 * PostgreSQL connection is therefore the safest fit for the worker while
 * DATABASE_URL remains the Prisma runtime pool.
 */
function createBoss(): PgBoss {
  const connectionString = serverConfig.server.directUrl ?? serverConfig.server.databaseUrl;
  if (connectionString === undefined) {
    throw new Error("Job system is not configured: DATABASE_URL or DIRECT_URL is required.");
  }

  const boss = new PgBoss({
    connectionString,
    schema: JOB_SCHEMA,
    // LISTEN/NOTIFY is an optimization. Polling remains the reliable baseline
    // and avoids requiring a session-pinned connection through poolers.
    useListenNotify: false,
    application_name: "guardian-jobs",
  });

  boss.on("error", (error) => {
    logger.error("job_system_error", { error });
  });

  return boss;
}

/** Returns the process-wide pg-boss instance without opening a DB connection. */
export function getJobBoss(): PgBoss {
  if (globalForJobs.__guardianPgBoss !== undefined) {
    return globalForJobs.__guardianPgBoss;
  }

  const boss = createBoss();
  globalForJobs.__guardianPgBoss = boss;
  return boss;
}

/** Starts pg-boss exactly once for this process. */
export async function startJobBoss(): Promise<PgBoss> {
  const boss = getJobBoss();
  await boss.start();
  return boss;
}
