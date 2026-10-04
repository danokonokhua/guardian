import { describe, expect, it } from "vitest";
import {
  synthesizeExecutiveDirectives,
  type OrganizationTelemetryAggregate,
} from "@/services/ai-coo/engine";

describe("AI COO Synthesis Engine (PRD §16, §17, §23, §25)", () => {
  it("synthesizes P0 Immediate lead funnel collapse directive when form failures exceed 20%", () => {
    const telemetry: OrganizationTelemetryAggregate = {
      websiteId: "w-1",
      hostname: "acme-corp.com",
      sslDaysRemaining: 45,
      uptimePercent: 99.9,
      openIssuesCount: 2,
      criticalIssuesCount: 0,
      formFailureRate: 0.35, // 35% failure rate
      averageLatencyMs: 600,
      missingMetaCount: 0,
      starRating: 4.8,
      unansweredReviews: 0,
      competitorTrafficGap: 5,
    };

    const directives = synthesizeExecutiveDirectives(telemetry);
    expect(directives.length).toBeGreaterThanOrEqual(1);

    const leadDirective = directives.find((d) => d.category === "REVENUE_PROTECTION");
    expect(leadDirective).toBeDefined();
    expect(leadDirective?.priorityTier).toBe("P0_IMMEDIATE");
    expect(leadDirective?.urgencyScore).toBe(98);
    expect(leadDirective?.businessImpactUsd).toBeGreaterThanOrEqual(1000);
    expect(leadDirective?.operationalAction).toContain("Deploy verified form submission handler");
  });

  it("synthesizes P0 Immediate TLS expiry directive when SSL runway is <= 7 days", () => {
    const telemetry: OrganizationTelemetryAggregate = {
      websiteId: "w-2",
      hostname: "payments-site.com",
      sslDaysRemaining: 4, // 4 days remaining
      uptimePercent: 99.9,
      openIssuesCount: 1,
      criticalIssuesCount: 1,
      formFailureRate: 0.0,
      averageLatencyMs: 400,
      missingMetaCount: 0,
      starRating: 5.0,
      unansweredReviews: 0,
      competitorTrafficGap: 0,
    };

    const directives = synthesizeExecutiveDirectives(telemetry);
    const sslDirective = directives.find((d) => d.category === "REVENUE_PROTECTION");
    expect(sslDirective).toBeDefined();
    expect(sslDirective?.title).toContain("Emergency TLS Renewal Runway (4 Days)");
    expect(sslDirective?.priorityTier).toBe("P0_IMMEDIATE");
    expect(sslDirective?.businessImpactUsd).toBe(8500);
  });

  it("synthesizes P1 Core Web Vitals and TTFB acceleration directive on latency spikes", () => {
    const telemetry: OrganizationTelemetryAggregate = {
      websiteId: "w-3",
      hostname: "store.com",
      sslDaysRemaining: 90,
      uptimePercent: 99.8,
      openIssuesCount: 3,
      criticalIssuesCount: 0,
      formFailureRate: 0.0,
      averageLatencyMs: 1850, // High latency > 1200ms
      missingMetaCount: 0,
      starRating: 4.5,
      unansweredReviews: 0,
      competitorTrafficGap: 10,
    };

    const directives = synthesizeExecutiveDirectives(telemetry);
    const perfDirective = directives.find((d) => d.category === "CONVERSION_RATE");
    expect(perfDirective).toBeDefined();
    expect(perfDirective?.priorityTier).toBe("P1_THIS_WEEK");
    expect(perfDirective?.urgencyScore).toBe(82);
    expect(perfDirective?.operationalAction).toContain("Cloudflare edge caching");
  });

  it("synthesizes P2 reputation safeguard directive when unanswered reviews exist", () => {
    const telemetry: OrganizationTelemetryAggregate = {
      websiteId: "w-4",
      hostname: "local-service.com",
      sslDaysRemaining: 120,
      uptimePercent: 99.9,
      openIssuesCount: 0,
      criticalIssuesCount: 0,
      formFailureRate: 0.0,
      averageLatencyMs: 500,
      missingMetaCount: 0,
      starRating: 3.8,
      unansweredReviews: 5,
      competitorTrafficGap: 0,
    };

    const directives = synthesizeExecutiveDirectives(telemetry);
    const repDirective = directives.find((d) => d.category === "REPUTATION_SAFEGUARD");
    expect(repDirective).toBeDefined();
    expect(repDirective?.priorityTier).toBe("P2_THIS_MONTH");
    expect(repDirective?.operationalAction).toContain("empathetic AI responses");
  });

  it("orders directives strictly by urgency score descending", () => {
    const telemetry: OrganizationTelemetryAggregate = {
      websiteId: "w-5",
      hostname: "multi-vector.com",
      sslDaysRemaining: 5, // P0 (98)
      uptimePercent: 98.9, // P1 (82)
      openIssuesCount: 4,
      criticalIssuesCount: 1,
      formFailureRate: 0.25,
      averageLatencyMs: 1600, // P1
      missingMetaCount: 4, // P1 (76)
      starRating: 3.5,
      unansweredReviews: 3, // P2 (68)
      competitorTrafficGap: 35, // P3 (55)
    };

    const directives = synthesizeExecutiveDirectives(telemetry);
    expect(directives.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < directives.length - 1; i++) {
      expect(directives[i]!.urgencyScore).toBeGreaterThanOrEqual(directives[i + 1]!.urgencyScore);
    }
  });
});
