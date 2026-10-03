import { describe, expect, it, vi } from "vitest";
import {
  isVersionOlder,
  parseSemverParts,
  WordpressTelemetrySchema,
  detectWordpressAnomalies,
} from "@/services/integrations/wordpress/collector";
import * as issueEngine from "@/lib/issue-engine";

describe("WordPress Collector & Anomaly Engine", () => {
  describe("version utilities", () => {
    it("parses version parts cleanly", () => {
      expect(parseSemverParts("6.7.1")).toEqual([6, 7, 1]);
      expect(parseSemverParts("v8.2.0-beta")).toEqual([8, 2, 0]);
      expect(parseSemverParts("7.4")).toEqual([7, 4]);
    });

    it("evaluates version comparisons correctly", () => {
      expect(isVersionOlder("6.4.1", "6.5.0")).toBe(true);
      expect(isVersionOlder("6.5.0", "6.4.1")).toBe(false);
      expect(isVersionOlder("6.5.0", "6.5.0")).toBe(false);
      expect(isVersionOlder("7.4.33", "8.1.0")).toBe(true);
      expect(isVersionOlder("8.2.14", "8.1.0")).toBe(false);
    });
  });

  describe("schema validation", () => {
    it("validates realistic payload and applies defaults", () => {
      const parsed = WordpressTelemetrySchema.parse({
        wpVersion: "6.7.1",
        phpVersion: "8.3.4",
      });

      expect(parsed.wpVersion).toBe("6.7.1");
      expect(parsed.phpVersion).toBe("8.3.4");
      expect(parsed.debugMode).toBe(false);
      expect(parsed.httpsEnforced).toBe(true);
      expect(parsed.plugins).toEqual([]);
      expect(parsed.updatesAvailable).toEqual({ core: 0, plugins: 0, themes: 0 });
    });
  });

  describe("anomaly detection", () => {
    it("flags outdated core, debug mode, deprecated PHP, and vulnerable plugin", async () => {
      const recordSpy = vi
        .spyOn(issueEngine, "recordFindingWithClient")
        .mockResolvedValue({ id: "issue-123", created: true });
      const resolveSpy = vi
        .spyOn(issueEngine, "resolveFindingScoped")
        .mockResolvedValue();

      const fakePrisma = {} as any;

      const result = await detectWordpressAnomalies(
        {
          wpVersion: "6.1.1", // severely outdated (< 6.2)
          phpVersion: "7.4.33", // EOL (< 8.0)
          debugMode: true,
          httpsEnforced: true,
          updatesAvailable: { core: 1, plugins: 2, themes: 0 },
          plugins: [
            {
              name: "Contact Form X",
              slug: "contact-form-x",
              version: "1.2.0",
              active: true,
              hasUpdate: true,
              vulnerable: true,
              vulnerabilityNotice: "Unauthenticated SQL Injection CVE-2026-9999",
            },
            {
              name: "Yoast SEO",
              slug: "wordpress-seo",
              version: "22.0",
              active: true,
              hasUpdate: false,
              vulnerable: false,
            },
          ],
          themes: [],
        },
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detectedCount).toBe(4);
      expect(recordSpy).toHaveBeenCalledTimes(4);

      // Verify Rule 1: Outdated core
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_WP_OUTDATED_CORE",
          severity: "CRITICAL",
          subjectKey: "wp-core-outdated",
        }),
        fakePrisma,
      );

      // Verify Rule 2: Debug mode exposed
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_WP_DEBUG_EXPOSED",
          severity: "HIGH",
          subjectKey: "wp-debug-exposed",
        }),
        fakePrisma,
      );

      // Verify Rule 3: Deprecated PHP
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_WP_DEPRECATED_PHP",
          severity: "HIGH",
          subjectKey: "wp-php-deprecated",
        }),
        fakePrisma,
      );

      // Verify Rule 4: Vulnerable Plugin
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_WP_VULNERABLE_PLUGIN",
          severity: "CRITICAL",
          subjectKey: "wp-vulnerable-contact-form-x",
        }),
        fakePrisma,
      );

      recordSpy.mockRestore();
      resolveSpy.mockRestore();
    });

    it("resolves findings when site is updated and healthy", async () => {
      const recordSpy = vi.spyOn(issueEngine, "recordFindingWithClient");
      const resolveSpy = vi
        .spyOn(issueEngine, "resolveFindingScoped")
        .mockResolvedValue();

      const fakePrisma = {} as any;

      const result = await detectWordpressAnomalies(
        {
          wpVersion: "6.7.1", // modern
          phpVersion: "8.3.1", // modern
          debugMode: false, // secure
          httpsEnforced: true,
          updatesAvailable: { core: 0, plugins: 0, themes: 0 },
          plugins: [
            {
              name: "Contact Form X",
              slug: "contact-form-x",
              version: "1.3.0",
              active: true,
              hasUpdate: false,
              vulnerable: false,
            },
          ],
          themes: [],
        },
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detectedCount).toBe(0);
      expect(recordSpy).not.toHaveBeenCalled();
      expect(resolveSpy).toHaveBeenCalledTimes(4); // Outdated core, debug mode, PHP, and fixed plugin resolved

      recordSpy.mockRestore();
      resolveSpy.mockRestore();
    });
  });
});
