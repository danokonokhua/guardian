import { startJobBoss } from "@/lib/jobs/boss";
import { registerSystemPingWorker } from "@/lib/jobs/system-ping";
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import { registerNotificationWorker, inAppNotificationProvider } from "@/lib/notifications";
import { registerSlaEscalationWorker, scheduleDueSlaEscalations } from "@/lib/jobs/sla-escalation";
import { scheduleDueMonitors } from "@/lib/jobs/scheduler";
import { logger } from "@/lib/logger";

/** Long-running Guardian background worker entrypoint. */
async function main(): Promise<void> {
  const boss = await startJobBoss();
  await registerSystemPingWorker(boss);
  await registerMonitorCheckWorker(boss);
  await registerNotificationWorker(boss, inAppNotificationProvider);
  await registerSlaEscalationWorker(boss);

  const runSchedulers = async (): Promise<void> => {
    await scheduleDueMonitors(boss);
    await scheduleDueSlaEscalations(boss);
  };
  const schedulerTimer = setInterval(() => {
    void runSchedulers().catch((error: unknown) =>
      logger.error("guardian_scheduler_error", { error }),
    );
  }, 60_000);
  void runSchedulers().catch((error: unknown) =>
    logger.error("guardian_scheduler_error", { error }),
  );
  logger.info("guardian_worker_started", { worker: "system.ping", schedulers: ["monitor", "sla"] });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("guardian_worker_stopping", { signal });
    clearInterval(schedulerTimer);
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
