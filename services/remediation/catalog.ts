import "server-only";

import type { RemediationBlueprint } from "./types";

export const REMEDIATION_BLUEPRINTS: Record<string, RemediationBlueprint> = {
  DISABLE_WP_DEBUG: {
    actionType: "DISABLE_WP_DEBUG",
    title: "Disable Exposed WordPress Debug Mode",
    description:
      "Updates wp-config.php to set WP_DEBUG_DISPLAY to false and suppress PHP stack traces on production pages.",
    riskLevel: "MEDIUM",
    recommendation:
      "Suppress public PHP debug stack traces to eliminate critical information disclosure risks.",
    autoExecutable: false,
    rollbackPlan: {
      action: "RESTORE_WP_DEBUG",
      description: "Reverts wp-config.php debug display flags to their prior configuration.",
      originalState: { WP_DEBUG_DISPLAY: true },
      steps: ["Restore backup wp-config.php", "Purge server opcode cache"],
    },
  },
  INJECT_SECURITY_HEADERS: {
    actionType: "INJECT_SECURITY_HEADERS",
    title: "Inject Essential HTTP Security Headers",
    description:
      "Applies HSTS (Strict-Transport-Security), X-Frame-Options (DENY), and X-Content-Type-Options (nosniff) headers.",
    riskLevel: "LOW",
    recommendation:
      "Enforce modern TLS transport and frame protection headers to prevent clickjacking and MIME attacks.",
    autoExecutable: true,
    rollbackPlan: {
      action: "REMOVE_SECURITY_HEADERS",
      description: "Removes injected HTTP headers from edge proxy.",
      originalState: { headersInjected: false },
      steps: ["Remove custom edge headers", "Purge proxy configuration"],
    },
  },
  PURGE_EDGE_CACHE: {
    actionType: "PURGE_EDGE_CACHE",
    title: "Purge Stale Edge CDN Cache",
    description:
      "Flushes the edge proxy static cache to force origin asset re-validation and clear degraded latency.",
    riskLevel: "LOW",
    recommendation: "Flush stale CDN cache to restore sub-second Time to First Byte (TTFB).",
    autoExecutable: true,
    rollbackPlan: {
      action: "PREWARM_EDGE_CACHE",
      description: "Requests warm-up crawler on primary entry routes.",
      originalState: { cachePurged: true },
      steps: ["Trigger synthetic warm-up crawler on homepage and top 10 routes"],
    },
  },
  UPDATE_WORDPRESS_CORE: {
    actionType: "UPDATE_WORDPRESS_CORE",
    title: "Apply WordPress Security Core Maintenance",
    description:
      "Updates WordPress to the latest minor security maintenance release after capturing a filesystem snapshot.",
    riskLevel: "HIGH",
    recommendation:
      "Upgrade to the latest security patch to remediate known remote code execution vulnerabilities.",
    autoExecutable: false,
    rollbackPlan: {
      action: "RESTORE_FILESYSTEM_SNAPSHOT",
      description: "Restores previous WordPress core binaries from timestamped pre-update archive.",
      originalState: { version: "pre-update" },
      steps: [
        "Unpack pre-update archive into webroot",
        "Verify database schema integrity",
        "Restart PHP worker pool",
      ],
    },
  },
  RETEST_FORM_ENDPOINT: {
    actionType: "RETEST_FORM_ENDPOINT",
    title: "Dispatch Synthetic Lead-Form Verification Probe",
    description:
      "Sends a safe sandbox submission probe through the lead capture endpoint to verify form handler availability.",
    riskLevel: "LOW",
    recommendation: "Verify lead capture submission pipeline after endpoint reconfiguration.",
    autoExecutable: true,
    rollbackPlan: {
      action: "FLAG_ENDPOINT_MANUAL",
      description: "Marks lead form endpoint for immediate operator manual inspection.",
      originalState: { testSubmitted: true },
      steps: ["Notify site administrator of persistent submission failure"],
    },
  },
  REMOVE_NOINDEX_HEADER: {
    actionType: "REMOVE_NOINDEX_HEADER",
    title: "Remove Accidental X-Robots-Tag Noindex Header",
    description:
      "Removes noindex directive from production response headers to restore search engine indexation.",
    riskLevel: "HIGH",
    recommendation:
      "Remove noindex header immediately to prevent Google de-indexing of key organic landing pages.",
    autoExecutable: false,
    rollbackPlan: {
      action: "RESTORE_ROBOTS_HEADER",
      description: "Re-applies previous robots directives if staging isolation was intended.",
      originalState: { noindexRemoved: true },
      steps: ["Re-apply staging header rules if confirmed non-production"],
    },
  },
};

/**
 * Resolves an appropriate remediation blueprint based on rule ID or action type.
 */
export function resolveBlueprint(ruleOrAction: string): RemediationBlueprint {
  if (REMEDIATION_BLUEPRINTS[ruleOrAction]) {
    return REMEDIATION_BLUEPRINTS[ruleOrAction]!;
  }

  // Map known anomaly rule IDs to blueprints
  const ruleMap: Record<string, string> = {
    RULE_WP_DEBUG_EXPOSED: "DISABLE_WP_DEBUG",
    RULE_WP_OUTDATED_CORE: "UPDATE_WORDPRESS_CORE",
    RULE_PERF_SLOW_PAGE: "PURGE_EDGE_CACHE",
    RULE_FORM_BROKEN: "RETEST_FORM_ENDPOINT",
    RULE_SEO_NOINDEX_LEAK: "REMOVE_NOINDEX_HEADER",
  };

  const mapped = ruleMap[ruleOrAction];
  if (mapped && REMEDIATION_BLUEPRINTS[mapped]) {
    return REMEDIATION_BLUEPRINTS[mapped]!;
  }

  // Default fallback safe action
  return {
    actionType: "PURGE_EDGE_CACHE",
    title: "Purge Stale Cache & Refresh Diagnostics",
    description: "Flushes the edge proxy cache and triggers a fresh diagnostics pass.",
    riskLevel: "LOW",
    recommendation: "Clear cache and trigger a diagnostics check to evaluate resolution.",
    autoExecutable: true,
    rollbackPlan: {
      action: "LOG_NOOP",
      description: "No rollback required for diagnostic cache purge.",
      originalState: {},
      steps: ["Refresh monitoring status"],
    },
  };
}
