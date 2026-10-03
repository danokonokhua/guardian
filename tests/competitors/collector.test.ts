import { describe, expect, it, vi } from "vitest";
import {
  extractPromotionalOffer,
  calculateSeoCompleteness,
  parseHtmlMetadata,
  generateSandboxCompetitorProbe,
  compareCompetitorSnapshots,
  detectCompetitorAnomalies,
} from "@/services/competitors/collector";
import * as issueEngine from "@/lib/issue-engine";

describe("Competitor Intelligence Collector", () => {
  describe("extractPromotionalOffer", () => {
    it("detects percentage discounts", () => {
      expect(extractPromotionalOffer("Get 20% off all annual plans today")).toBe("20% off");
      expect(extractPromotionalOffer("Special 15% discount for teams")).toBe("15% discount");
    });

    it("detects dollar discounts and savings", () => {
      expect(extractPromotionalOffer("Save $50 when you sign up")).toBe("Save $50");
      expect(extractPromotionalOffer("Save 30% off your first month")).toBe("Save 30% off");
    });

    it("detects free trial and consultation CTAs", () => {
      expect(extractPromotionalOffer("Start your 14-day free trial")).toBe("free trial");
      expect(extractPromotionalOffer("Book a free consultation today")).toBe("free consultation");
    });

    it("detects seasonal sales and price starting points", () => {
      expect(extractPromotionalOffer("Black Friday sale is live!")).toBe("Black Friday");
      expect(extractPromotionalOffer("Plans starts at $29/mo")).toBe("starts at $29/mo");
    });

    it("returns null if no promotional offer is present", () => {
      expect(extractPromotionalOffer("Our company provides mission critical infrastructure.")).toBeNull();
    });
  });

  describe("calculateSeoCompleteness", () => {
    it("calculates 100 for complete title, optimal length, meta desc, and H1", () => {
      const score = calculateSeoCompleteness(
        "Acme Cloud — Autonomous Enterprise Security Platform",
        "Protect and scale your digital assets with 24/7 autonomous monitoring and incident resolution.",
        "Autonomous Enterprise Security",
      );
      expect(score).toBe(100);
    });

    it("calculates partial score when missing elements", () => {
      const score = calculateSeoCompleteness("Short Title", null, null);
      expect(score).toBe(30);
    });
  });

  describe("parseHtmlMetadata", () => {
    it("parses title, meta description, og:title, h1, and offers", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Acme Corp — Modern Workflow Software</title>
            <meta name="description" content="Acme helps companies streamline operations.">
            <meta property="og:title" content="Acme Social Preview">
          </head>
          <body>
            <h1>Streamline Operations</h1>
            <div class="banner">Get 25% off this week only!</div>
          </body>
        </html>
      `;

      const parsed = parseHtmlMetadata(sampleHtml);
      expect(parsed.pageTitle).toBe("Acme Corp — Modern Workflow Software");
      expect(parsed.metaDescription).toBe("Acme helps companies streamline operations.");
      expect(parsed.ogTitle).toBe("Acme Social Preview");
      expect(parsed.h1).toBe("Streamline Operations");
      expect(parsed.detectedOffer).toBe("25% off");
    });
  });

  describe("generateSandboxCompetitorProbe", () => {
    it("generates deterministic realistic probe results", () => {
      const probe1 = generateSandboxCompetitorProbe("competitor.com", "fixed-seed-1");
      const probe2 = generateSandboxCompetitorProbe("competitor.com", "fixed-seed-1");

      expect(probe1.httpStatus).toBe(200);
      expect(probe1.responseTimeMs).toBeGreaterThan(0);
      expect(probe1.pageTitle).toBeTruthy();
      expect(probe1.h1).toBeTruthy();
      expect(probe1.seoScore).toBeGreaterThan(50);
      expect(probe1.contentHash).toBe(probe2.contentHash);
    });
  });

  describe("compareCompetitorSnapshots", () => {
    it("flags baseline capture on first snapshot", () => {
      const probe = generateSandboxCompetitorProbe("acme.com");
      const diff = compareCompetitorSnapshots(probe, null);

      expect(diff.hasChanges).toBe(false);
      expect(diff.changeSummary).toBe("Initial baseline captured");
    });

    it("detects title, H1, and offer changes", () => {
      const previous: any = {
        pageTitle: "Old Title",
        metaDescription: "Same Description",
        h1: "Old Headline",
        detectedOffer: null,
      };

      const current: any = {
        pageTitle: "New Title",
        metaDescription: "Same Description",
        h1: "New Headline",
        detectedOffer: "30% off",
      };

      const diff = compareCompetitorSnapshots(current, previous);
      expect(diff.hasChanges).toBe(true);
      expect(diff.titleChanged).toBe(true);
      expect(diff.h1Changed).toBe(true);
      expect(diff.offerChanged).toBe(true);
      expect(diff.changeSummary).toContain("New offer detected: \"30% off\"");
      expect(diff.changeSummary).toContain("Page title updated");
    });
  });

  describe("detectCompetitorAnomalies", () => {
    it("emits RULE_COMPETITOR_OFFER_CHANGE and RULE_COMPETITOR_SPEED_ADVANTAGE", async () => {
      const recordSpy = vi
        .spyOn(issueEngine, "recordFindingWithClient")
        .mockResolvedValue({ id: "iss-comp-1", created: true } as any);
      const resolveSpy = vi
        .spyOn(issueEngine, "resolveFindingScoped")
        .mockResolvedValue(undefined as any);

      const fakePrisma = {
        website: {
          findFirst: vi.fn().mockResolvedValue({ id: "site-1" }),
        },
      } as any;

      const competitor = { id: "comp-1", name: "Rival Corp", domain: "rival.com" };
      const currentProbe = {
        httpStatus: 200,
        responseTimeMs: 150, // Much faster than customer 850ms
        pageTitle: "Rival Title",
        metaDescription: "Rival Desc",
        h1: "Updated Rival Headline",
        detectedOffer: "25% off annual plans",
        seoScore: 90,
        contentHash: "hash-1",
        metadata: {},
      };
      const diff = {
        hasChanges: true,
        changeSummary: "New offer and H1 headline changed",
        titleChanged: false,
        descriptionChanged: false,
        h1Changed: true,
        offerChanged: true,
        previousOffer: null,
        currentOffer: "25% off annual plans",
      };

      const result = await detectCompetitorAnomalies(
        competitor,
        currentProbe,
        diff,
        { organizationId: "org-1", websiteId: "site-1", customerSiteSpeedMs: 850 },
        fakePrisma,
      );

      expect(result.detectedCount).toBe(3); // Offer change + speed advantage + H1 headline shift
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_COMPETITOR_OFFER_CHANGE",
          severity: "MEDIUM",
        }),
        fakePrisma,
      );
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_COMPETITOR_SPEED_ADVANTAGE",
        }),
        fakePrisma,
      );
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_COMPETITOR_SEO_HEADLINE_SHIFT",
          severity: "INFO",
        }),
        fakePrisma,
      );

      recordSpy.mockRestore();
      resolveSpy.mockRestore();
    });
  });
});

