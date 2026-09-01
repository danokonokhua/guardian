/** Shared job names and storage constants for the Guardian job foundation. */

export const JOB_SCHEMA = "guardian_jobs" as const;
export const SYSTEM_PING_JOB = "system.ping" as const;
export const SYSTEM_PING_SINGLETON_KEY = "system-ping" as const;
export const MONITOR_CHECK_JOB = "monitor.check" as const;

export const JOB_RETRY_LIMIT = 2 as const;
export const JOB_RETRY_DELAY_SECONDS = 5 as const;
export const JOB_EXPIRE_SECONDS = 60 as const;
