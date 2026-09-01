import "server-only";

/**
 * Sentry observability foundation (Phase 1B-08) — optional and config-driven.
 *
 * - Enabled ONLY when SENTRY_DSN is present in the central server config
 *   (config/server.ts ← config/env.ts). No DSN → every call is a no-op and
 *   local development is completely unaffected.
 * - Initialization is lazy and idempotent; the DSN is never hardcoded and
 *   never logged.
 * - Only unexpected server-side errors (non-AppError, or AppError with a 5xx
 *   status) are captured — expected 4xx business outcomes are not events.
 * - Event hints pass through the logger's redaction policy
 *   (lib/logger#redactForLogging) so request metadata can never leak
 *   tokens/cookies/credentials to the observability sink.
 */

import * as Sentry from "@sentry/node";

import { serverConfig } from "@/config/server";
import { redactForLogging } from "@/lib/logger";

export interface CaptureHints {
  readonly requestId?: string;
  readonly route?: string;
  readonly [key: string]: unknown;
}

let initialized = false;

/** Initializes Sentry exactly once when (and only when) a DSN is configured. */
function ensureInitialized(): boolean {
  if (initialized) {
    return serverConfig.server.sentryDsn !== undefined;
  }
  const dsn = serverConfig.server.sentryDsn;
  if (dsn === undefined) {
    // Stay disabled; do not mark initialized so a later config change in
    // long-running tests still re-evaluates.
    return false;
  }
  Sentry.init({
    dsn,
    // Server-only foundation: attach the request id as a tag for correlation.
    // No request bodies, no PII enrichment, no tracing integrations in this
    // phase — error capture only.
    sendDefaultPii: false,
  });
  Sentry.setTag("service", serverConfig.serviceName);
  Sentry.setTag("env", serverConfig.appEnv);
  initialized = true;
  return true;
}

/** True when Sentry is configured (tests and diagnostics use this). */
export function isSentryEnabled(): boolean {
  return serverConfig.server.sentryDsn !== undefined && ensureInitialized();
}

/**
 * Captures an unexpected server-side error with sanitized hints. Never
 * throws — observability must not break the error path it observes.
 */
export function captureUnexpectedError(error: unknown, hints: CaptureHints = {}): void {
  try {
    if (!isSentryEnabled()) {
      return;
    }
    Sentry.captureException(error, {
      tags: {
        ...(typeof hints.requestId === "string" ? { requestId: hints.requestId } : {}),
        ...(typeof hints.route === "string" ? { route: hints.route } : {}),
      },
      extra: redactForLogging({ ...hints, error: serializeErrorForSentry(error) }) as Record<
        string,
        unknown
      >,
    });
  } catch {
    // Swallow intentionally: the error boundary must proceed regardless.
  }
}

function serializeErrorForSentry(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return redactForLogging(error);
}
