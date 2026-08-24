import "server-only";

/**
 * Server-only configuration aggregate.
 *
 * The `server-only` import at the top is a bundler-enforced marker: any
 * attempt to import this module (directly or transitively) from a Client
 * Component fails the build. This is the architectural guarantee that
 * DATABASE_URL, DIRECT_URL, and SUPABASE_SERVICE_ROLE_KEY can never reach
 * the browser. In tests, Vitest aliases the marker to a no-op stub because
 * there is no bundler boundary under plain Node.
 */
import {
  loadConfig,
  type AppConfig,
  type ConfigIssue,
  type LogLevel,
  type NodeEnv,
  type PublicConfig,
  type ServerConfig,
} from "@/config/env";

export type { AppConfig, ConfigIssue, LogLevel, NodeEnv, PublicConfig, ServerConfig };
export { EnvironmentConfigError, loadConfig } from "@/config/env";

/** Loads the full (public + server) configuration from a raw environment. */
export const loadServerConfig = loadConfig;

/** Process-wide server configuration singleton. */
export const serverConfig: AppConfig = loadConfig();

/** Backward-compatible alias used by early foundation modules. */
export const appConfig: AppConfig = serverConfig;
