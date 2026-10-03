import "server-only";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  recordFindingWithClient,
  resolveFindingScoped,
  issueFingerprint,
} from "@/lib/issue-engine";

export const WordpressPluginSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  version: z.string().default("1.0.0"),
  active: z.boolean().default(true),
  hasUpdate: z.boolean().default(false),
  updateVersion: z.string().optional(),
  vulnerable: z.boolean().default(false),
  vulnerabilityNotice: z.string().optional(),
});

export const WordpressThemeSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  version: z.string().default("1.0.0"),
  active: z.boolean().default(true),
  hasUpdate: z.boolean().default(false),
  updateVersion: z.string().optional(),
});

export const WordpressTelemetrySchema = z.object({
  wpVersion: z.string().min(1),
  phpVersion: z.string().min(1),
  serverSoftware: z.string().optional(),
  debugMode: z.boolean().default(false),
  httpsEnforced: z.boolean().default(true),
  updatesAvailable: z
    .object({
      core: z.number().int().nonnegative().default(0),
      plugins: z.number().int().nonnegative().default(0),
      themes: z.number().int().nonnegative().default(0),
    })
    .default({ core: 0, plugins: 0, themes: 0 }),
  plugins: z.array(WordpressPluginSchema).default([]),
  themes: z.array(WordpressThemeSchema).default([]),
  databaseSizeMb: z.number().optional(),
  lastBackupAt: z.string().nullable().optional(),
});

export type WordpressPluginInfo = z.infer<typeof WordpressPluginSchema>;
export type WordpressThemeInfo = z.infer<typeof WordpressThemeSchema>;
export type WordpressTelemetryPayload = z.infer<typeof WordpressTelemetrySchema>;

export function parseSemverParts(version: string): number[] {
  const clean = version.replace(/[^0-9.]/g, "");
  return clean.split(".").map((num) => Number.parseInt(num, 10) || 0);
}

export function isVersionOlder(version: string, target: string): boolean {
  const vParts = parseSemverParts(version);
  const tParts = parseSemverParts(target);
  const maxLen = Math.max(vParts.length, tParts.length);

  for (let i = 0; i < maxLen; i++) {
    const a = vParts[i] ?? 0;
    const b = tParts[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

export interface WordpressAnomalyResult {
  detectedCount: number;
  resolvedCount: number;
  issueIds: string[];
}

export async function detectWordpressAnomalies(
  telemetry: WordpressTelemetryPayload,
  context: { organizationId: string; websiteId: string },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<WordpressAnomalyResult> {
  let detectedCount = 0;
  let resolvedCount = 0;
  const issueIds: string[] = [];

  const { organizationId, websiteId } = context;

  // 1. Check WordPress Core Version
  // Recommended baseline: 6.5+ (current standard is 6.7.x)
  const isCoreOutdated =
    telemetry.updatesAvailable.core > 0 || isVersionOlder(telemetry.wpVersion, "6.5.0");

  if (isCoreOutdated) {
    const isCritical = isVersionOlder(telemetry.wpVersion, "6.2.0");
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_WP_OUTDATED_CORE",
        subjectKey: "wp-core-outdated",
        severity: isCritical ? "CRITICAL" : "HIGH",
        title: `WordPress Core Outdated: v${telemetry.wpVersion}`,
        summary: `WordPress core is running version ${telemetry.wpVersion}, which is behind the recommended secure baseline. Security updates are pending.`,
        businessImpact:
          "Outdated WordPress versions are actively targeted by automated exploit bots for admin takeover, backdoor injection, and malicious redirects.",
        impactConfidence: 0.95,
        recommendedAction:
          "Upgrade WordPress to the latest version immediately via your WordPress Admin or hosting control panel.",
        technicalEvidence: {
          wpVersion: telemetry.wpVersion,
          updatesAvailable: telemetry.updatesAvailable,
          isCritical,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    // Resolve if previously flagged
    const fp = issueFingerprint({
      ruleId: "RULE_WP_OUTDATED_CORE",
      websiteId,
      subjectKey: "wp-core-outdated",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 2. Check Debug Mode (WP_DEBUG)
  if (telemetry.debugMode) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_WP_DEBUG_EXPOSED",
        subjectKey: "wp-debug-exposed",
        severity: "HIGH",
        title: "WordPress Debug Mode (WP_DEBUG) Active in Production",
        summary:
          "WP_DEBUG is enabled on this public website, risking exposure of database credentials, PHP error traces, and internal server paths.",
        businessImpact:
          "Public debug traces allow bad actors to map internal server structure, software vulnerabilities, and database schemas for targeted attacks.",
        impactConfidence: 0.9,
        recommendedAction:
          "Set WP_DEBUG to false in wp-config.php and ensure WP_DEBUG_DISPLAY is disabled.",
        technicalEvidence: {
          debugMode: telemetry.debugMode,
          serverSoftware: telemetry.serverSoftware,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_WP_DEBUG_EXPOSED",
      websiteId,
      subjectKey: "wp-debug-exposed",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 3. Check PHP Version (EOL is < 8.1; recommended is 8.2+)
  const isPhpDeprecated = isVersionOlder(telemetry.phpVersion, "8.1.0");
  if (isPhpDeprecated) {
    const isPhpSeverelyOld = isVersionOlder(telemetry.phpVersion, "8.0.0");
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_WP_DEPRECATED_PHP",
        subjectKey: "wp-php-deprecated",
        severity: isPhpSeverelyOld ? "HIGH" : "MEDIUM",
        title: `Unsupported PHP Runtime: v${telemetry.phpVersion}`,
        summary: `The server environment is running PHP ${telemetry.phpVersion}, which has reached official End-of-Life (EOL) with no security patches.`,
        businessImpact:
          "Unsupported PHP runtimes lack patches for remote code execution and memory corruption vulnerabilities, and modern plugins will eventually fail to run.",
        impactConfidence: 0.85,
        recommendedAction:
          "Upgrade your web server PHP version to PHP 8.2 or 8.3 via your web hosting dashboard.",
        technicalEvidence: {
          phpVersion: telemetry.phpVersion,
          serverSoftware: telemetry.serverSoftware,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_WP_DEPRECATED_PHP",
      websiteId,
      subjectKey: "wp-php-deprecated",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 4. Check Vulnerable Plugins
  const vulnerablePlugins = telemetry.plugins.filter((p) => p.vulnerable);
  for (const plugin of vulnerablePlugins) {
    const subjectKey = `wp-vulnerable-${(plugin.slug || plugin.name).toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_WP_VULNERABLE_PLUGIN",
        subjectKey,
        severity: "CRITICAL",
        title: `Vulnerable Plugin: ${plugin.name} v${plugin.version}`,
        summary: `Plugin "${plugin.name}" (${plugin.version}) has an active vulnerability report: ${plugin.vulnerabilityNotice || "Security update required"}.`,
        businessImpact:
          "Compromised plugins can be exploited to upload arbitrary web shells, harvest user credentials, or execute cross-site scripting (XSS) on customer sessions.",
        impactConfidence: 0.98,
        recommendedAction: `Update "${plugin.name}" to version ${plugin.updateVersion ?? "latest"} immediately or deactivate the plugin.`,
        technicalEvidence: {
          plugin,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  }

  // Resolve plugins that are no longer vulnerable
  const safePluginSlugs = telemetry.plugins.filter((p) => !p.vulnerable);
  for (const plugin of safePluginSlugs) {
    const subjectKey = `wp-vulnerable-${(plugin.slug || plugin.name).toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const fp = issueFingerprint({
      ruleId: "RULE_WP_VULNERABLE_PLUGIN",
      websiteId,
      subjectKey,
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
  }

  return {
    detectedCount,
    resolvedCount,
    issueIds,
  };
}
