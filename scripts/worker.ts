import { startJobBoss } from "@/lib/jobs/boss";
import { registerSystemPingWorker } from "@/lib/jobs/system-ping";
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import { logger } from "@/lib/logger";

/** Long-running Guardian background worker entrypoint. */
async function main(): Promise<void> {
  const boss = await startJobBoss();
  await registerSystemPingWorker(boss);
  await registerMonitorCheckWorker(boss);
  logger.info("guardian_worker_started", { worker: "system.ping" });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("guardian_worker_stopping", { signal });
    await boss.stop({ graceful: true, timeout: 30_000 });
    logger.info("guardian_worker_stopped", { signal });
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT").catch((error: unknown) => {
      logger.error("guardian_worker_shutdown_error", { error });
      process.exitCode = 1;
    });
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM").catch((error: unknown) => {
      logger.error("guardian_worker_shutdown_error", { error });
      process.exitCode = 1;
    });
  });
}

main().catch((error: unknown) => {
  logger.error("guardian_worker_boot_error", { error });
  process.exitCode = 1;
});
