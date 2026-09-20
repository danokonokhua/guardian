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
 *   This keeps `next build` / dev / test working before deployment secrets are
 *   supplied; runtime integrations validate their required values when they
 *   initialize.
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
}

/** Server-only configuration. Must never be imported into client code. */
export interface ServerConfig {
  /** PostgreSQL connection string used by runtime queries. */
  readonly databaseUrl?: string;
  /** Direct PostgreSQL connection string used by migrations. */
  readonly directUrl?: string;
  /** Sentry ingestion DSN (optional — error capture stays disabled without it). */
  readonly sentryDsn?: string;
  /** Server-only secret required by the scheduler tick endpoint. */
  readonly cronSecret?: string;
  /** Optional signed analytics reporting destination. */
  readonly reportingWebhookUrl?: string;
  /** Secret used to sign analytics reporting payloads. */
  readonly reportingWebhookSecret?: string;
  /** SMTP server hostname for operational email delivery. */
  readonly smtpHost?: string;
  /** SMTP server port. */
  readonly smtpPort?: number;
  /** SMTP username. */
  readonly smtpUser?: string;
  /** SMTP password or provider token. */
  readonly smtpPassword?: string;
  /** Whether SMTP uses implicit TLS (normally port 465). */
  readonly smtpSecure?: boolean;
  /** Verified sender address used for operational emails. */
  readonly mailFromEmail?: string;
  /** Optional display name for operational emails. */
  readonly mailFromName?: string;
  /** Initial self-hosted owner account email (bootstrap service only). */
  readonly guardianAdminEmail?: string;
  /** Initial self-hosted owner password (bootstrap service only). */
  readonly guardianAdminPassword?: string;
  /** Initial self-hosted owner display name. */
  readonly guardianAdminName?: string;
  /** Initial organization name created for the owner. */
  readonly guardianOrganizationName?: string;
  /** Whether a trusted reverse proxy supplies the client IP headers. */
  readonly trustedProxy?: boolean;
  /** Shared secret header used to prove the request crossed that proxy. */
  readonly trustedProxyToken?: string;
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

function parseBoolean(value: string, name: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new EnvironmentConfigError(`${name} must be either true or false.`);
}

function parsePort(value: string, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EnvironmentConfigError(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

/**
 * Parses ONLY the browser-safe application URL. Referenced by
 * config/public.ts, which never touches server-only names.
 */
export function parsePublicConfig(env: RawEnv): PublicConfig {
  const appUrl = readString(env, "NEXT_PUBLIC_APP_URL");

  return {
    ...(appUrl !== undefined ? { appUrl: parseHttpUrl(appUrl, "NEXT_PUBLIC_APP_URL") } : {}),
  };
}

/** Parses ONLY server-only variables. Referenced by config/server.ts. */
export function parseServerConfig(env: RawEnv): ServerConfig {
  const databaseUrl = readString(env, "DATABASE_URL");
  const directUrl = readString(env, "DIRECT_URL");
  const sentryDsn = readString(env, "SENTRY_DSN");
  const cronSecret = readString(env, "CRON_SECRET");
  const reportingWebhookUrl = readString(env, "REPORTING_WEBHOOK_URL");
  const reportingWebhookSecret = readString(env, "REPORTING_WEBHOOK_SECRET");
  const smtpHost = readString(env, "SMTP_HOST");
  const smtpPortValue = readString(env, "SMTP_PORT");
  const smtpUser = readString(env, "SMTP_USER");
  const smtpPassword = readString(env, "SMTP_PASSWORD");
  const smtpSecureValue = readString(env, "SMTP_SECURE");
  const mailFromEmail = readString(env, "MAIL_FROM_EMAIL");
  const mailFromName = readString(env, "MAIL_FROM_NAME");
  const guardianAdminEmail = readString(env, "GUARDIAN_ADMIN_EMAIL");
  const guardianAdminPassword = readString(env, "GUARDIAN_ADMIN_PASSWORD");
  const guardianAdminName = readString(env, "GUARDIAN_ADMIN_NAME");
  const guardianOrganizationName = readString(env, "GUARDIAN_ORGANIZATION_NAME");
  const trustedProxyValue = readString(env, "TRUSTED_PROXY");
  const trustedProxyToken = readString(env, "TRUSTED_PROXY_TOKEN");
  const smtpPort = smtpPortValue === undefined ? undefined : parsePort(smtpPortValue, "SMTP_PORT");
  const smtpSecure =
    smtpSecureValue === undefined ? smtpPort === 465 : parseBoolean(smtpSecureValue, "SMTP_SECURE");
  const trustedProxy =
    trustedProxyValue === undefined ? undefined : parseBoolean(trustedProxyValue, "TRUSTED_PROXY");

  return {
    ...(databaseUrl !== undefined
      ? { databaseUrl: parsePostgresUrl(databaseUrl, "DATABASE_URL") }
      : {}),
    ...(directUrl !== undefined ? { directUrl: parsePostgresUrl(directUrl, "DIRECT_URL") } : {}),
    ...(sentryDsn !== undefined ? { sentryDsn: parseHttpUrl(sentryDsn, "SENTRY_DSN") } : {}),
    ...(cronSecret !== undefined ? { cronSecret } : {}),
    ...(reportingWebhookUrl !== undefined
      ? { reportingWebhookUrl: parseHttpUrl(reportingWebhookUrl, "REPORTING_WEBHOOK_URL") }
      : {}),
    ...(reportingWebhookSecret !== undefined ? { reportingWebhookSecret } : {}),
    ...(smtpHost !== undefined ? { smtpHost } : {}),
    ...(smtpPort !== undefined ? { smtpPort } : {}),
    ...(smtpUser !== undefined ? { smtpUser } : {}),
    ...(smtpPassword !== undefined ? { smtpPassword } : {}),
    ...(smtpHost !== undefined || smtpPort !== undefined || smtpSecureValue !== undefined
      ? { smtpSecure }
      : {}),
    ...(mailFromEmail !== undefined ? { mailFromEmail } : {}),
    ...(mailFromName !== undefined ? { mailFromName } : {}),
    ...(guardianAdminEmail !== undefined ? { guardianAdminEmail } : {}),
    ...(guardianAdminPassword !== undefined ? { guardianAdminPassword } : {}),
    ...(guardianAdminName !== undefined ? { guardianAdminName } : {}),
    ...(guardianOrganizationName !== undefined ? { guardianOrganizationName } : {}),
    ...(trustedProxy !== undefined ? { trustedProxy } : {}),
    ...(trustedProxyToken !== undefined ? { trustedProxyToken } : {}),
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
