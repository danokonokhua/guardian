/**
 * Guardian environment configuration — core parsing and validation.
 *
 * Architecture (Phase 1B-02):
 * - `config/env.ts`     — THIS FILE. Pure functions + types. Parses and
 *                         validates a raw environment object. No singleton,
 *                         no side effects. Safe to import anywhere (tests,
 *                         server, and — via config/public.ts — the browser).
 * - `config/public.ts`  — browser-safe subset (NEXT_PUBLIC_* only).
 * - `config/server.ts`  — server-only aggregate (imports the `server-only`
 *                         marker so bundlers refuse to include it in client
 *                         bundles). Holds the process-wide singleton.
 *
 * The only other sanctioned `process.env` reader is `next.config.ts`, which
 * Next.js evaluates before this layer exists and which only checks the
 * Next-managed NODE_ENV.
 *
 * Validation policy:
 * - INVALID values fail fast (throw) with actionable messages that reference
 *   the variable NAME — never the value (values may contain credentials).
 * - MISSING variables become `issues` (reportable warnings) rather than
 *   crashes, except where a value is structurally required by the runtime.
 *   This keeps `next build` / dev / test working before the database,
 *   Supabase, and other integrations exist (their variables stay optional
 *   until the phase that consumes them).
 * - Only variables with a current consumer (or reserved by an approved
 *   upcoming phase) are declared here. See `.env.example`.
 */

export type NodeEnv = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type ConfigScope = "public" | "server";

/** A reportable configuration problem (missing variable in a context). */
export interface ConfigIssue {
  readonly variable: string;
  readonly scope: ConfigScope;
  readonly message: string;
}

/** Browser-safe configuration (NEXT_PUBLIC_* variables only). */
export interface PublicConfig {
  /** Canonical application URL, e.g. https://guardian.example.com */
  readonly appUrl?: string;
  /** Supabase project URL (reserved — Supabase phase). */
  readonly supabaseUrl?: string;
  /** Supabase anon/public key (reserved — Supabase phase). */
  readonly supabaseAnonKey?: string;
}

/** Server-only configuration. Must never be imported into client code. */
export interface ServerConfig {
  /** Pooled PostgreSQL connection string (reserved — database phase). */
  readonly databaseUrl?: string;
  /** Direct (non-pooled) PostgreSQL connection string (reserved). */
  readonly directUrl?: string;
  /** Supabase service-role key (reserved). NEVER expose to the browser. */
  readonly supabaseServiceRoleKey?: string;
}

/** Full application configuration (server aggregate). */
export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly appEnv: string;
  readonly logLevel: LogLevel;
  readonly serviceName: "guardian";
  readonly public: PublicConfig;
  readonly server: ServerConfig;
  readonly issues: readonly ConfigIssue[];
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

type RawEnv = Readonly<Record<string, string | undefined>>;

/** Reads a trimmed value; blank strings count as unset. */
function readString(env: RawEnv, name: string): string | undefined {
  const value = env[name];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parses an enum-typed variable. The value is echoed in the error message —
 * only ever use this for non-secret classification variables.
 */
function parseEnum<T extends string>(value: string, allowed: readonly T[], name: string): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new EnvironmentConfigError(
    `Invalid ${name} "${value}". Expected one of: ${allowed.join(", ")}.`,
  );
}

/** Parses a mandatory http(s) URL. Never echoes the value. */
function parseHttpUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EnvironmentConfigError(
      `${name} must be a valid http(s) URL, for example https://guardian.example.com.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new EnvironmentConfigError(
      `${name} must use http or https (received protocol "${parsed.protocol}").`,
    );
  }
  return parsed.toString();
}

/**
 * Parses a PostgreSQL connection string. Never echoes the value — connection
 * strings embed credentials.
 */
function parsePostgresUrl(value: string, name: string): string {
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new EnvironmentConfigError(
      `${name} must be a valid PostgreSQL connection string, for example postgresql://user:password@host:5432/guardian.`,
    );
  }
  try {
    return new URL(value).toString();
  } catch {
    throw new EnvironmentConfigError(
      `${name} must be a valid PostgreSQL connection string, for example postgresql://user:password@host:5432/guardian.`,
    );
  }
}

/**
 * Parses ONLY NEXT_PUBLIC_* variables. Referenced by config/public.ts, which
 * is safe for browser bundles precisely because this function never touches
 * server-only names.
 */
export function parsePublicConfig(env: RawEnv): PublicConfig {
  const appUrl = readString(env, "NEXT_PUBLIC_APP_URL");
  const supabaseUrl = readString(env, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readString(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return {
    ...(appUrl !== undefined ? { appUrl: parseHttpUrl(appUrl, "NEXT_PUBLIC_APP_URL") } : {}),
    ...(supabaseUrl !== undefined
      ? { supabaseUrl: parseHttpUrl(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL") }
      : {}),
    ...(supabaseAnonKey !== undefined ? { supabaseAnonKey } : {}),
  };
}

/** Parses ONLY server-only variables. Referenced by config/server.ts. */
export function parseServerConfig(env: RawEnv): ServerConfig {
  const databaseUrl = readString(env, "DATABASE_URL");
  const directUrl = readString(env, "DIRECT_URL");
  const supabaseServiceRoleKey = readString(env, "SUPABASE_SERVICE_ROLE_KEY");

  return {
    ...(databaseUrl !== undefined
      ? { databaseUrl: parsePostgresUrl(databaseUrl, "DATABASE_URL") }
      : {}),
    ...(directUrl !== undefined ? { directUrl: parsePostgresUrl(directUrl, "DIRECT_URL") } : {}),
    ...(supabaseServiceRoleKey !== undefined ? { supabaseServiceRoleKey } : {}),
  };
}

/**
 * Validates and maps a raw environment into the typed application config.
 * Accepts an explicit environment object so tests never depend on (or
 * mutate) the real `process.env`.
 */
export function loadConfig(env: RawEnv = process.env): AppConfig {
  const nodeEnv = parseEnum(readString(env, "NODE_ENV") ?? "development", NODE_ENVS, "NODE_ENV");
  const logLevel = parseEnum(
    readString(env, "LOG_LEVEL") ?? DEFAULT_LOG_LEVEL,
    LOG_LEVELS,
    "LOG_LEVEL",
  );

  const publicConfig = parsePublicConfig(env);
  const serverConfig = parseServerConfig(env);

  const issues: ConfigIssue[] = [];
  if (nodeEnv === "production" && publicConfig.appUrl === undefined) {
    issues.push({
      variable: "NEXT_PUBLIC_APP_URL",
      scope: "public",
      message: "NEXT_PUBLIC_APP_URL is required in production deployments.",
    });
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
    appEnv: readString(env, "APP_ENV") ?? nodeEnv,
    logLevel,
    serviceName: "guardian",
    public: publicConfig,
    server: serverConfig,
    issues,
  };
}
