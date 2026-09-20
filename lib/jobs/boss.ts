import "server-only";

import { PgBoss } from "pg-boss";

import { serverConfig } from "@/config/server";
import { JOB_SCHEMA } from "@/lib/jobs/constants";
import { logger } from "@/lib/logger";

interface JobGlobal {
  __guardianPgBoss?: PgBoss;
  __guardianPgBossStart?: Promise<PgBoss>;
}

const globalForJobs = globalThis as JobGlobal;

/**
 * Creates the single pg-boss instance used by the Guardian process.
 *
 * pg-boss owns its schema setup and maintains its own connection pool, but it
 * must run as the same least-privilege runtime role as Prisma. DIRECT_URL is
 * reserved for the migration/bootstrap phase and is never used by workers.
 */
function createBoss(): PgBoss {
  const connectionString = serverConfig.server.databaseUrl;
  if (connectionString === undefined) {
    throw new Error("Job system is not configured: DATABASE_URL is required.");
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
  if (globalForJobs.__guardianPgBossStart !== undefined) {
    return globalForJobs.__guardianPgBossStart;
  }
  const starting = boss.start().then(() => boss);
  globalForJobs.__guardianPgBossStart = starting;
  try {
    return await starting;
  } catch (error) {
    delete globalForJobs.__guardianPgBossStart;
    throw error;
  }
}
