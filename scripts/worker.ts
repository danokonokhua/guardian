import "./server-only-cli.cjs";

let workerLogger:
  { error: (message: string, context?: Record<string, unknown>) => void } | undefined;

/** Long-running Guardian background worker entrypoint. */
async function main(): Promise<void> {
  // Load server-only modules only after the standalone Node entrypoint has
  // established its server-side runtime. Next.js uses the marker to prevent
  // browser imports; it is not a runtime restriction for this worker.
  const [
    { startJobBoss },
    { registerSystemPingWorker },
    { registerMonitorCheckWorker },
    { registerNotificationWorker, productionNotificationProvider },
    { registerSlaEscalationWorker, scheduleDueSlaEscalations },
    { scheduleDueMonitors },
    { logger },
  ] = await Promise.all([
    import("@/lib/jobs/boss"),
    import("@/lib/jobs/system-ping"),
    import("@/lib/jobs/monitor-check"),
    import("@/lib/notifications"),
    import("@/lib/jobs/sla-escalation"),
    import("@/lib/jobs/scheduler"),
    import("@/lib/logger"),
  ]);
  workerLogger = logger;
  const boss = await startJobBoss();
  await registerSystemPingWorker(boss);
  await registerMonitorCheckWorker(boss);
  await registerNotificationWorker(boss, productionNotificationProvider);
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
  if (workerLogger) workerLogger.error("guardian_worker_boot_error", { error });
  else process.stderr.write(`guardian_worker_boot_error: ${String(error)}\n`);
  process.exitCode = 1;
});
