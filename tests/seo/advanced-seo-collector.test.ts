import { describe, expect, it, vi } from "vitest";
import {
  runAdvancedSeoCheck,
  extractHeadingHierarchy,
  extractImageAltAudit,
  extractLinkCounts,
  extractStructuredData,
  metaTagValue,
} from "@/lib/jobs/seo-check";
import { recordAdvancedSeoFindings } from "@/services/seo/advanced-seo-collector";
import { assertCanUseAdvancedSeo } from "@/lib/billing/entitlements";
import { ForbiddenError } from "@/lib/errors";

describe("Advanced SEO Intelligence (Phase 16)", () => {
  const fakePrisma = {
    website: {
      findFirst: vi.fn().mockResolvedValue({ id: "site-1", organizationId: "org-1" }),
    },
    issue: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "issue-1" }),
      update: vi.fn().mockResolvedValue({ id: "issue-1" }),
      upsert: vi.fn().mockResolvedValue({ id: "issue-1", createdAt: new Date(), updatedAt: new Date() }),
    },
    issueActivity: {
      create: vi.fn().mockResolvedValue({ id: "act-1" }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as any;

  describe("HTML Extraction Utilities", () => {
    it("extracts meta tag values by name and property", () => {
      const html = `
        <meta name="description" content="This is a test description." />
        <meta property="og:title" content="Social Title" />
        <meta property="og:image" content="https://example.com/image.png" />
      `;
      expect(metaTagValue(html, "description")).toBe("This is a test description.");
      expect(metaTagValue(html, "og:title")).toBe("Social Title");
      expect(metaTagValue(html, "og:image")).toBe("https://example.com/image.png");
      expect(metaTagValue(html, "twitter:card")).toBeNull();
    });

    it("extracts valid and invalid JSON-LD structured data blocks", () => {
      const html = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Guardian Ops"
          }
        </script>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": "https://guardian.test"
          }
        </script>
        <script type="application/ld+json">
          { malformed json here }
        </script>
      `;
      const data = extractStructuredData(html);
      expect(data.found).toBe(true);
      expect(data.validCount).toBe(2);
      expect(data.invalidCount).toBe(1);
      expect(data.types).toContain("Organization");
      expect(data.types).toContain("WebSite");
    });

    it("evaluates heading hierarchy and detects multiple H1s", () => {
      const html = `
        <h1>Main Heading 1</h1>
        <h2>Section 1</h2>
        <h1>Accidental Duplicate H1</h1>
        <h3>Subsection</h3>
      `;
      const hierarchy = extractHeadingHierarchy(html);
      expect(hierarchy.h1Count).toBe(2);
      expect(hierarchy.hasMultipleH1).toBe(true);
      expect(hierarchy.hasMissingH1).toBe(false);
      expect(hierarchy.h2Count).toBe(1);
      expect(hierarchy.h3Count).toBe(1);
    });

    it("detects missing H1 headings", () => {
      const html = `
        <h2>Section 1</h2>
        <h3>Subsection</h3>
      `;
      const hierarchy = extractHeadingHierarchy(html);
      expect(hierarchy.h1Count).toBe(0);
      expect(hierarchy.hasMissingH1).toBe(true);
      expect(hierarchy.hasMultipleH1).toBe(false);
    });

    it("audits image alt attributes and ignores decorative images", () => {
      const html = `
        <img src="/photo1.jpg" alt="Team photo" />
        <img src="/photo2.jpg" />
        <img src="/photo3.jpg" role="presentation" />
        <img src="/photo4.jpg" aria-hidden="true" />
      `;
      const audit = extractImageAltAudit(html);
      expect(audit.total).toBe(4);
      expect(audit.withAlt).toBe(3); // 1 real alt + 2 decorative
      expect(audit.missingAlt).toBe(1);
    });

    it("accurately counts internal vs external links", () => {
      const html = `
        <a href="/about">About Us</a>
        <a href="https://example.com/pricing">Pricing</a>
        <a href="https://external-partner.com/docs">Partner</a>
        <a href="#section">Jump</a>
      `;
      const links = extractLinkCounts(html, "https://example.com");
      expect(links.internalCount).toBe(2); // /about and https://example.com/pricing
      expect(links.externalCount).toBe(1); // external-partner.com
      expect(links.totalCount).toBe(3);
    });
  });

  describe("runAdvancedSeoCheck Evaluation", () => {
    it("evaluates an optimal page with high score and no high severity issues", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Guardian Operations - Protect Digital Revenue</title>
          <meta name="description" content="Guardian continuously monitors the digital systems contributing to company revenue, identifying broken systems and SEO issues." />
          <link rel="canonical" href="https://example.com/" />
          <meta property="og:title" content="Guardian Operations - Protect Digital Revenue" />
          <meta property="og:description" content="Guardian continuously monitors digital revenue systems." />
          <meta property="og:image" content="https://example.com/og.jpg" />
          <meta name="twitter:card" content="summary_large_image" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Guardian"
            }
          </script>
        </head>
        <body>
          <h1>Protect Your Digital Business Operations</h1>
          <h2>Continuous Monitoring</h2>
          <img src="/logo.png" alt="Guardian Logo" />
          <a href="/pricing">View Plans</a>
        </body>
        </html>
      `;

      const result = await runAdvancedSeoCheck("https://example.com", html);
      expect(result.healthy).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.titleStatus).toBe("optimal");
      expect(result.descriptionStatus).toBe("optimal");
      expect(result.openGraph.present).toBe(true);
      expect(result.structuredData.found).toBe(true);
      expect(result.headings.h1Count).toBe(1);
      expect(result.images.missingAlt).toBe(0);
      expect(result.canonicalOriginMatch).toBe(true);
    });

    it("flags external canonical hijack, missing schema, and bad title lengths", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Short</title>
          <!-- Missing description -->
          <link rel="canonical" href="https://attacker-domain.com/" />
          <!-- Missing OpenGraph -->
        </head>
        <body>
          <h2>No H1 Tag here</h2>
          <img src="/ad.jpg" />
        </body>
        </html>
      `;

      const result = await runAdvancedSeoCheck("https://example.com", html);
      expect(result.healthy).toBe(false); // external canonical is HIGH severity
      expect(result.score).toBeLessThan(60);

      const ruleIds = result.issues.map((i) => i.ruleId);
      expect(ruleIds).toContain("RULE_SEO_TITLE_LENGTH");
      expect(ruleIds).toContain("RULE_SEO_DESCRIPTION_LENGTH");
      expect(ruleIds).toContain("RULE_SEO_H1_VIOLATION");
      expect(ruleIds).toContain("RULE_SEO_CANONICAL_MISMATCH");
      expect(ruleIds).toContain("RULE_SEO_MISSING_OG");
      expect(ruleIds).toContain("RULE_SEO_MISSING_SCHEMA");
      expect(ruleIds).toContain("RULE_SEO_IMAGES_NO_ALT");
    });
  });

  describe("Service Layer Finding Registration", () => {
    it("records detected SEO findings using Prisma client", async () => {
      const analysis = await runAdvancedSeoCheck(
        "https://example.com",
        "<html><head><title>A</title></head><body></body></html>",
      );

      const result = await recordAdvancedSeoFindings(
        analysis,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.recordedCount).toBeGreaterThan(0);
      expect(fakePrisma.issue.upsert).toHaveBeenCalled();
    });
  });

  describe("Plan Entitlement Guards", () => {
    it("permits Growth, Pro, Agency, White Label, and Enterprise tiers", () => {
      expect(() => assertCanUseAdvancedSeo("GROWTH")).not.toThrow();
      expect(() => assertCanUseAdvancedSeo("PRO")).not.toThrow();
      expect(() => assertCanUseAdvancedSeo("AGENCY")).not.toThrow();
      expect(() => assertCanUseAdvancedSeo("WHITE_LABEL")).not.toThrow();
      expect(() => assertCanUseAdvancedSeo("ENTERPRISE")).not.toThrow();
    });

    it("denies Free and Starter tiers", () => {
      expect(() => assertCanUseAdvancedSeo("FREE")).toThrow(ForbiddenError);
      expect(() => assertCanUseAdvancedSeo("STARTER")).toThrow(ForbiddenError);
    });
  });
});
