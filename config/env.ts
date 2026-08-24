/**
 * Centralized environment configuration.
 *
 * This is the ONLY module in the application that reads `process.env`.
 * (Single sanctioned exception: `next.config.ts`, which Next.js evaluates
 * before this layer exists and which only checks Next-managed NODE_ENV.)
 *
 * Rules:
 * - Fail fast: invalid values crash the process at startup with a clear
 *   message instead of surfacing as mysterious behavior later.
 * - Only declare variables that are actually consumed today. Future sections
 *   (database, Supabase, email, AI, payments) will be added in their own
 *   phases together with the code that reads them — see `.env.example`.
 */

export type NodeEnv = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppConfig {
  /** Node/Next runtime environment (Next-managed). */
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  /** Minimum severity emitted by the structured logger. */
  readonly logLevel: LogLevel;
  /** Stable service identifier used in logs, health output, and alerts. */
  readonly serviceName: "guardian";
  /** Human-readable deployment label (local | development | staging | production). */
  readonly appEnv: string;
}

/** Thrown when an environment variable holds a value the application refuses. */
export class EnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentConfigError";
  }
}

const NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];
const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
const DEFAULT_LOG_LEVEL: LogLevel = "info";

function isNodeEnv(value: string): value is NodeEnv {
  return (NODE_ENVS as readonly string[]).includes(value);
}

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Validates and maps a raw environment into the typed application config.
 * Accepts an explicit environment object so tests never depend on (or mutate)
 * the real `process.env`.
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppConfig {
  const rawNodeEnv = env["NODE_ENV"] ?? "development";
  if (!isNodeEnv(rawNodeEnv)) {
    throw new EnvironmentConfigError(
      `Invalid NODE_ENV "${rawNodeEnv}". Expected one of: ${NODE_ENVS.join(", ")}.`,
    );
  }

  const rawLogLevel = env["LOG_LEVEL"] ?? DEFAULT_LOG_LEVEL;
  if (!isLogLevel(rawLogLevel)) {
    throw new EnvironmentConfigError(
      `Invalid LOG_LEVEL "${rawLogLevel}". Expected one of: ${LOG_LEVELS.join(", ")}.`,
    );
  }

  return {
    nodeEnv: rawNodeEnv,
    isProduction: rawNodeEnv === "production",
    isTest: rawNodeEnv === "test",
    logLevel: rawLogLevel,
    serviceName: "guardian",
    appEnv: env["APP_ENV"] ?? rawNodeEnv,
  };
}

/** Process-wide configuration singleton. */
export const appConfig: AppConfig = loadConfig();
