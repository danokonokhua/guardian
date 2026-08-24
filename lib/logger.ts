/* eslint-disable no-console --
 * The logger is the single sanctioned consumer of the console APIs; the
 * eslint config enforces `no-console` everywhere else. Swap this module's
 * sink for an external provider later without touching call sites.
 */
import { appConfig, type LogLevel } from "@/config/server";

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger whose entries always include the given context. */
  child(context: LogContext): Logger;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MAX_DEPTH = 4;
const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const SENSITIVE_KEY_PATTERN =
  /password|passphrase|secret|token|api[-_]?key|authorization|credential/i;

/**
 * Recursively prepares a value for logging: redacts sensitive keys,
 * serializes errors, and caps depth as a defensive measure against
 * pathological structures. Never throws.
 */
function sanitize(value: unknown, depth: number): unknown {
  try {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    if (depth >= MAX_DEPTH) {
      return TRUNCATED;
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item, depth + 1));
    }
    // Safe narrowing cast: `typeof value === "object"` was established above.
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitize(item, depth + 1);
    }
    return result;
  } catch {
    return TRUNCATED;
  }
}

export interface LoggerOptions {
  /** Overrides the minimum emitted level (defaults to the app config level). */
  level?: LogLevel;
}

export function createLogger(baseContext: LogContext = {}, options: LoggerOptions = {}): Logger {
  const minLevel = options.level ?? appConfig.logLevel;

  const write = (level: LogLevel, message: string, context?: LogContext): void => {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
      return;
    }
    const entry = {
      time: new Date().toISOString(),
      level,
      service: appConfig.serviceName,
      env: appConfig.appEnv,
      msg: message,
      // Safe cast: sanitize() maps plain objects to plain objects.
      ...(sanitize({ ...baseContext, ...context }, 0) as LogContext),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (context) => createLogger({ ...baseContext, ...context }, { level: minLevel }),
  };
}

/** Application-wide logger singleton. */
export const logger: Logger = createLogger();
