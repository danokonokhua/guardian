import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import {
  generateWordpressToken,
  encryptWordpressToken,
  decryptWordpressToken,
} from "@/lib/integrations/wordpress/secrets";
import {
  WordpressTelemetrySchema,
  detectWordpressAnomalies,
  type WordpressTelemetryPayload,
  type WordpressAnomalyResult,
} from "@/services/integrations/wordpress/collector";
import {
  disconnectWordpressConnection,
  findWordpressConnection,
  findWordpressConnectionByPrefix,
  upsertWordpressConnection,
  type WordpressConnectionRecord,
} from "@/services/integrations/wordpress/repository";
import { captureHealthScoreSnapshot } from "@/services/health/repository";
import { issueFingerprint, resolveFindingScoped } from "@/lib/issue-engine";
import { logger } from "@/lib/logger";

export interface ConnectWordpressInput {
  websiteId: string;
  siteUrl?: string;
  isSandbox?: boolean;
}

export interface ConnectWordpressResult {
  connection: WordpressConnectionRecord;
  token: string;
}

export interface SyncWordpressResult {
  connection: WordpressConnectionRecord;
  anomalies: WordpressAnomalyResult;
}

const DEFAULT_SANDBOX_TELEMETRY: WordpressTelemetryPayload = {
  wpVersion: "6.4.2", // Outdated (baseline 6.5+)
  phpVersion: "8.1.12",
  serverSoftware: "nginx/1.24.0 (Sandbox)",
  debugMode: true, // Exposed WP_DEBUG
  httpsEnforced: true,
  updatesAvailable: { core: 1, plugins: 2, themes: 0 },
  plugins: [
    {
      name: "WooCommerce",
      slug: "woocommerce",
      version: "8.5.1",
      active: true,
      hasUpdate: true,
      updateVersion: "8.6.0",
      vulnerable: false,
    },
    {
      name: "Contact Form 7",
      slug: "contact-form-7",
      version: "5.8.4",
      active: true,
      hasUpdate: true,
      updateVersion: "5.9.0",
      vulnerable: true,
      vulnerabilityNotice: "Input validation bypass CVE-2026-3829",
    },
    {
      name: "Yoast SEO",
      slug: "wordpress-seo",
      version: "22.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
    {
      name: "Elementor",
      slug: "elementor",
      version: "3.19.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
  ],
  themes: [
    {
      name: "Astra",
      slug: "astra",
      version: "4.6.4",
      active: true,
      hasUpdate: false,
    },
  ],
  databaseSizeMb: 142.5,
  lastBackupAt: new Date(Date.now() - 3600000 * 12).toISOString(),
};

const CLEAN_SANDBOX_TELEMETRY: WordpressTelemetryPayload = {
  wpVersion: "6.7.1", // Latest secure
  phpVersion: "8.3.4",
  serverSoftware: "nginx/1.24.0 (Sandbox)",
  debugMode: false, // Secure
  httpsEnforced: true,
  updatesAvailable: { core: 0, plugins: 0, themes: 0 },
  plugins: [
    {
      name: "WooCommerce",
      slug: "woocommerce",
      version: "8.6.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
    {
      name: "Contact Form 7",
      slug: "contact-form-7",
      version: "5.9.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
    {
      name: "Yoast SEO",
      slug: "wordpress-seo",
      version: "22.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
    {
      name: "Elementor",
      slug: "elementor",
      version: "3.19.0",
      active: true,
      hasUpdate: false,
      vulnerable: false,
    },
  ],
  themes: [
    {
      name: "Astra",
      slug: "astra",
      version: "4.6.4",
      active: true,
      hasUpdate: false,
    },
  ],
  databaseSizeMb: 143.1,
  lastBackupAt: new Date().toISOString(),
};

export async function connectWordpressSite(
  scope: TenantScope,
  input: ConnectWordpressInput,
): Promise<ConnectWordpressResult> {
  const { websiteId, isSandbox = false } = input;

  const result = await withTenantTransaction(scope, async (tx) => {
    // 1. Verify website belongs to organization
    const website = await tx.website.findFirst({
      where: { id: websiteId, organizationId: scope.organizationId },
    });
    if (!website) {
      throw new NotFoundError("Website not found in organization.");
    }

    const cleanHostname = website.hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const siteUrl = input.siteUrl || `https://${cleanHostname}`;
    const tokenInfo = generateWordpressToken(isSandbox);
    const context = `${scope.organizationId}:${websiteId}`;
    const tokenEncrypted = encryptWordpressToken(tokenInfo.token, context);

    let connection: WordpressConnectionRecord;

    if (isSandbox) {
      // Create with rich simulated telemetry
      connection = await tx.wordpressConnection.upsert({
        where: { websiteId },
        create: {
          organizationId: scope.organizationId,
          websiteId,
          siteUrl,
          tokenEncrypted,
          tokenPrefix: tokenInfo.tokenPrefix,
          status: "CONNECTED",
          isSandbox: true,
          wpVersion: DEFAULT_SANDBOX_TELEMETRY.wpVersion,
          phpVersion: DEFAULT_SANDBOX_TELEMETRY.phpVersion,
          serverSoftware: DEFAULT_SANDBOX_TELEMETRY.serverSoftware,
          debugMode: DEFAULT_SANDBOX_TELEMETRY.debugMode,
          httpsEnforced: DEFAULT_SANDBOX_TELEMETRY.httpsEnforced,
          updatesAvailable: DEFAULT_SANDBOX_TELEMETRY.updatesAvailable as any,
          plugins: DEFAULT_SANDBOX_TELEMETRY.plugins as any,
          themes: DEFAULT_SANDBOX_TELEMETRY.themes as any,
          lastSyncAt: new Date(),
        },
        update: {
          siteUrl,
          tokenEncrypted,
          tokenPrefix: tokenInfo.tokenPrefix,
          status: "CONNECTED",
          isSandbox: true,
          wpVersion: DEFAULT_SANDBOX_TELEMETRY.wpVersion,
          phpVersion: DEFAULT_SANDBOX_TELEMETRY.phpVersion,
          serverSoftware: DEFAULT_SANDBOX_TELEMETRY.serverSoftware,
          debugMode: DEFAULT_SANDBOX_TELEMETRY.debugMode,
          httpsEnforced: DEFAULT_SANDBOX_TELEMETRY.httpsEnforced,
          updatesAvailable: DEFAULT_SANDBOX_TELEMETRY.updatesAvailable as any,
          plugins: DEFAULT_SANDBOX_TELEMETRY.plugins as any,
          themes: DEFAULT_SANDBOX_TELEMETRY.themes as any,
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      // Immediately run anomaly detection
      await detectWordpressAnomalies(
        DEFAULT_SANDBOX_TELEMETRY,
        { organizationId: scope.organizationId, websiteId },
        tx,
      );
    } else {
      // Live site connection pending handshake
      connection = await tx.wordpressConnection.upsert({
        where: { websiteId },
        create: {
          organizationId: scope.organizationId,
          websiteId,
          siteUrl,
          tokenEncrypted,
          tokenPrefix: tokenInfo.tokenPrefix,
          status: "CONNECTED",
          isSandbox: false,
          lastSyncAt: null,
        },
        update: {
          siteUrl,
          tokenEncrypted,
          tokenPrefix: tokenInfo.tokenPrefix,
          status: "CONNECTED",
          isSandbox: false,
          lastError: null,
        },
      });
    }

    return {
      connection,
      token: tokenInfo.token,
    };
  });

  // Refresh digital health score outside database transaction (best effort)
  try {
    await captureHealthScoreSnapshot(scope);
  } catch (err) {
    logger.warn("health_score_snapshot_after_wp_connect_failed", {
      organizationId: scope.organizationId,
      websiteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

export async function syncWordpressSite(
  scope: TenantScope,
  websiteId: string,
  options?: { simulateFix?: boolean },
): Promise<SyncWordpressResult> {
  const connection = await findWordpressConnection(scope, websiteId);
  if (!connection) {
    throw new NotFoundError("WordPress connection not found.");
  }

  const result = await withTenantTransaction(scope, async (tx) => {
    let telemetry: WordpressTelemetryPayload;

    if (connection.isSandbox) {
      // Handle sandbox demo mode toggle
      telemetry = options?.simulateFix ? CLEAN_SANDBOX_TELEMETRY : DEFAULT_SANDBOX_TELEMETRY;
    } else {
      // Live outbound probe to WordPress REST endpoint
      const context = `${scope.organizationId}:${websiteId}`;
      let plainToken: string;
      try {
        plainToken = decryptWordpressToken(connection.tokenEncrypted, context);
      } catch {
        throw new Error("Unable to decrypt pairing credentials.");
      }

      const baseSiteUrl = connection.siteUrl.replace(/\/+$/, "");
      const probeUrl = `${baseSiteUrl}/wp-json/guardian/v1/health`;
      try {
        const response = await fetch(probeUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${plainToken}`,
            Accept: "application/json",
            "User-Agent": "Guardian-Health-Monitor/1.0",
          },
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const rawData = await response.json();
          telemetry = WordpressTelemetrySchema.parse(rawData);
        } else if (response.status === 404) {
          // Plugin is not yet active on the WordPress site. Probe core /wp-json/ to verify site reachability.
          const coreResponse = await fetch(`${baseSiteUrl}/wp-json/`, {
            method: "GET",
            headers: { Accept: "application/json", "User-Agent": "Guardian-Health-Monitor/1.0" },
            signal: AbortSignal.timeout(6000),
          });
          if (coreResponse.ok) {
            const serverHdr =
              coreResponse.headers.get("server") ||
              (coreResponse.headers.get("x-litespeed-cache") ? "LiteSpeed" : "Web Server");
            telemetry = {
              wpVersion: "WordPress (Awaiting Plugin)",
              phpVersion: "Awaiting Plugin",
              serverSoftware: serverHdr,
              debugMode: false,
              httpsEnforced: baseSiteUrl.startsWith("https://"),
              updatesAvailable: { core: 0, plugins: 0, themes: 0 },
              plugins: [],
              themes: [],
            };
          } else {
            throw new Error(`WordPress core REST API returned HTTP ${coreResponse.status}`);
          }
        } else {
          throw new Error(`WordPress probe responded with HTTP ${response.status}`);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Sync probe failed";
        await tx.wordpressConnection.update({
          where: { websiteId },
          data: {
            status: "ERROR",
            lastError: errorMessage,
            lastSyncAt: new Date(),
          },
        });
        throw new Error(`WordPress connection sync failed: ${errorMessage}`);
      }
    }

    // Update connection telemetry
    const updated = await tx.wordpressConnection.update({
      where: { websiteId },
      data: {
        status: "CONNECTED",
        wpVersion: telemetry.wpVersion,
        phpVersion: telemetry.phpVersion,
        serverSoftware: telemetry.serverSoftware,
        debugMode: telemetry.debugMode,
        httpsEnforced: telemetry.httpsEnforced,
        updatesAvailable: telemetry.updatesAvailable as any,
        plugins: telemetry.plugins as any,
        themes: telemetry.themes as any,
        lastError: null,
        lastSyncAt: new Date(),
      },
    });

    // Detect anomalies and resolve fixed issues
    const anomalies = await detectWordpressAnomalies(
      telemetry,
      { organizationId: scope.organizationId, websiteId },
      tx,
    );

    return {
      connection: updated,
      anomalies,
    };
  });

  // Refresh health score outside transaction (best effort)
  try {
    await captureHealthScoreSnapshot(scope);
  } catch (err) {
    logger.warn("health_score_snapshot_after_wp_sync_failed", {
      organizationId: scope.organizationId,
      websiteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/**
 * Inbound push handler for WordPress plugin webhook.
 * Authenticates bearer token in constant time, records telemetry, and runs anomaly checks.
 */
export async function ingestWordpressWebhook(
  rawToken: string,
  rawPayload: unknown,
): Promise<{ ok: boolean; syncedAt: string; websiteId: string }> {
  if (!rawToken || rawToken.length < 18) {
    throw new UnauthorizedError("Invalid or missing WordPress authorization token.");
  }

  const tokenPrefix = rawToken.substring(0, 18);
  const connection = await findWordpressConnectionByPrefix(tokenPrefix);
  if (!connection) {
    throw new UnauthorizedError("WordPress connection token not recognized.");
  }

  // Constant-time token verification
  const context = `${connection.organizationId}:${connection.websiteId}`;
  let expectedToken: string;
  try {
    expectedToken = decryptWordpressToken(connection.tokenEncrypted, context);
  } catch {
    throw new UnauthorizedError("Failed to decrypt stored credentials.");
  }

  const aBuf = Buffer.from(rawToken, "utf8");
  const bBuf = Buffer.from(expectedToken, "utf8");
  if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) {
    throw new UnauthorizedError("Invalid WordPress pairing token.");
  }

  // Validate incoming telemetry
  const telemetry = WordpressTelemetrySchema.parse(rawPayload);

  const scope: TenantScope = {
    organizationId: connection.organizationId,
    userId: "system-wp-webhook",
    role: "OWNER",
  };

  await withTenantTransaction(scope, async (tx) => {
    await tx.wordpressConnection.update({
      where: { websiteId: connection.websiteId },
      data: {
        status: "CONNECTED",
        wpVersion: telemetry.wpVersion,
        phpVersion: telemetry.phpVersion,
        serverSoftware: telemetry.serverSoftware,
        debugMode: telemetry.debugMode,
        httpsEnforced: telemetry.httpsEnforced,
        updatesAvailable: telemetry.updatesAvailable as any,
        plugins: telemetry.plugins as any,
        themes: telemetry.themes as any,
        lastError: null,
        lastSyncAt: new Date(),
      },
    });

    await detectWordpressAnomalies(
      telemetry,
      { organizationId: connection.organizationId, websiteId: connection.websiteId },
      tx,
    );
  });

  try {
    await captureHealthScoreSnapshot(scope);
  } catch (err) {
    logger.warn("health_score_snapshot_after_wp_webhook_failed", {
      organizationId: scope.organizationId,
      websiteId: connection.websiteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    websiteId: connection.websiteId,
  };
}

export async function disconnectWordpressSite(
  scope: TenantScope,
  websiteId: string,
): Promise<void> {
  const connection = await findWordpressConnection(scope, websiteId);
  if (!connection) {
    throw new NotFoundError("WordPress connection not found.");
  }

  await withTenantTransaction(scope, async (tx) => {
    // 1. Delete connection
    await tx.wordpressConnection.deleteMany({
      where: { organizationId: scope.organizationId, websiteId },
    });

    // 2. Clean up associated WordPress issues
    const wpRules = [
      "RULE_WP_OUTDATED_CORE",
      "RULE_WP_DEBUG_EXPOSED",
      "RULE_WP_DEPRECATED_PHP",
      "RULE_WP_VULNERABLE_PLUGIN",
    ];

    for (const ruleId of wpRules) {
      const issues = await tx.issue.findMany({
        where: {
          organizationId: scope.organizationId,
          websiteId,
          ruleId: { startsWith: ruleId },
          status: { not: "RESOLVED" },
        },
        select: { fingerprint: true },
      });

      for (const iss of issues) {
        await resolveFindingScoped(
          { organizationId: scope.organizationId },
          iss.fingerprint,
          tx as any,
        );
      }
    }
  });

  // Refresh health score outside transaction (best effort)
  try {
    await captureHealthScoreSnapshot(scope);
  } catch (err) {
    logger.warn("health_score_snapshot_after_wp_disconnect_failed", {
      organizationId: scope.organizationId,
      websiteId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
