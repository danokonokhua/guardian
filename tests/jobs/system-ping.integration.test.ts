import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";

import { registerSystemPingWorker, enqueueSystemPing } from "@/lib/jobs/system-ping";
import { JOB_SCHEMA, SYSTEM_PING_JOB } from "@/lib/jobs/constants";

const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];

describe.skipIf(TEST_DATABASE_URL === undefined)(
  "system.ping job (live PostgreSQL integration)",
  () => {
    it("starts pg-boss, claims and completes one job with DB-visible proof", async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
      const boss = new PgBoss({
        connectionString: TEST_DATABASE_URL,
        schema: JOB_SCHEMA,
        useListenNotify: false,
        application_name: "guardian-jobs-test",
      });

      await boss.start();
      try {
        await registerSystemPingWorker(boss);
        const result = await enqueueSystemPing(boss);

        expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(result.deduplicated).toBe(false);

        const jobId = result.jobId;
        let completed = false;
        let state: string | undefined;

        for (let attempt = 0; attempt < 100; attempt += 1) {
          const rows = await prisma.$queryRawUnsafe<Array<{ state: string }>>(
            `SELECT state::text AS state FROM ${JOB_SCHEMA}.job WHERE id = $1::uuid AND name = $2`,
            jobId,
            SYSTEM_PING_JOB,
          );
          state = rows[0]?.state;
          if (state === "completed") {
            completed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(completed, `job ${jobId} ended in state ${state ?? "missing"}`).toBe(true);
      } finally {
        await boss.stop({ graceful: true, timeout: 5_000 });
        await prisma.$disconnect();
      }
    });
  },
);
