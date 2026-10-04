/**
 * Guardian Plan Catalog & Pricing Specification.
 * Canonical definitions aligned with PRD Section 19, docs/PRICING.md, and the
 * master feature/limits table (updated 2 October 2026).
 *
 * Monetary values are in US cents.
 * Infinity is used for "Custom / unlimited" numeric limits.
 * null is used for "negotiated" or "not applicable" limits.
 */

export const BILLING_PLANS = [
  // ΓöÇΓöÇΓöÇ Free Audit ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "FREE",
    name: "Free Audit",
    tagline: "Find out what's wrong.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    /** No trial ΓÇö the plan itself is the free tier. */
    hasTrial: false,
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: 1,
      maxBusinesses: 1,
      maxTeamMembers: 1,
      /** Snapshot / one-time ΓÇö no scheduled frequency. */
      minFrequencyMinutes: null as null | number,
      /** Snapshot only ΓÇö no history retention. */
      historyDays: 0,
      /** Critical pages monitored (null = N/A). */
      maxCriticalPages: null as null | number,
      /** Lead/form slots. */
      maxLeadForms: null as null | number,
      /** AI insights per month. */
      aiInsightsPerMonth: 0,
    },
    features: {
      // Monitoring
      continuousMonitoring: false,
      uptimeChecks: true,           // one-time snapshot
      sslChecks: true,              // snapshot
      securityHeaders: true,        // snapshot
      dnsMonitoring: true,          // snapshot
      domainExpiryMonitoring: true, // snapshot
      spfDmarcChecks: false,
      // SEO
      basicSeo: true,
      advancedSeo: false,
      // Scanning
      brokenLinkScanning: true,     // sample only
      performanceMonitoring: true,  // snapshot
      accessibilityMonitoring: false,
      // Forms & Journeys
      leadFormMonitoring: true,     // snapshot
      syntheticFormTests: false,
      bookingCheckoutMonitoring: false,
      // Scores & Issues
      digitalHealthScore: true,     // snapshot
      issueDetection: true,         // basic
      businessImpactExplanation: true, // basic
      fixRecommendations: true,     // basic
      automatedRemediation: false,
      // Alerts
      inAppAlerts: false,
      emailAlerts: false,
      digests: false,
      // AI (gated separately by aiInsightsPerMonth)
      aiIssueExplanations: false,
      aiPrioritization: false,
      aiBusinessSummaries: false,
      // Integrations
      googleIntegrations: false,
      googleAnalytics: false,
      googleSearchConsole: false,
      googleBusinessProfile: false,
      wordpressConnect: false,
      marketplaceIntegrations: false,
      // Intelligence
      reputationMonitoring: false,
      competitorIntelligence: false,
      marketingIntelligence: false,
      // Agency / multi-client
      multiClientDashboard: false,
      bulkScans: false,
      clientAccounts: false,
      // Access & Permissions
      roleBasedPermissions: false,
      apiAccess: false,
      // Branding
      agencyBranding: false,
      customLogo: false,
      removeGuardianBranding: false,
      customDashboardBranding: false,
      customDomain: false,
      brandedEmails: false,
      brandedReports: false,
      // Support / SLA
      prioritySupport: false,
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ Starter ΓÇö $9 / mo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "STARTER",
    name: "Starter",
    tagline: "Protect my website.",
    monthlyPriceCents: 900,
    annualPriceCents: 9_000,   // $90/yr
    hasTrial: true,
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: 1,
      maxBusinesses: 1,
      maxTeamMembers: 2,
      minFrequencyMinutes: 5,
      historyDays: 30,
      maxCriticalPages: 3,
      maxLeadForms: 1,
      aiInsightsPerMonth: 10,
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,              // daily
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: false,
      basicSeo: true,
      advancedSeo: false,
      brokenLinkScanning: true,     // limited
      performanceMonitoring: true,  // daily
      accessibilityMonitoring: false,
      leadFormMonitoring: true,
      syntheticFormTests: false,
      bookingCheckoutMonitoring: false,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: false,
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,                // monthly only
      aiIssueExplanations: true,    // limited
      aiPrioritization: false,
      aiBusinessSummaries: false,
      googleIntegrations: false,
      googleAnalytics: false,
      googleSearchConsole: false,
      googleBusinessProfile: false,
      wordpressConnect: true,
      marketplaceIntegrations: false,
      reputationMonitoring: false,
      competitorIntelligence: false,
      marketingIntelligence: false,
      multiClientDashboard: false,
      bulkScans: false,
      clientAccounts: false,
      roleBasedPermissions: true,   // basic
      apiAccess: false,
      agencyBranding: false,
      customLogo: false,
      removeGuardianBranding: false,
      customDashboardBranding: false,
      customDomain: false,
      brandedEmails: false,
      brandedReports: false,
      prioritySupport: false,       // standard
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ Growth ΓÇö $29 / mo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "GROWTH",
    name: "Growth",
    tagline: "Monitor my digital health.",
    monthlyPriceCents: 2_900,
    annualPriceCents: 29_000,  // $290/yr
    hasTrial: true,
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: 5,
      maxBusinesses: 3,
      maxTeamMembers: 5,
      minFrequencyMinutes: 5,
      historyDays: 90,
      maxCriticalPages: 10,
      maxLeadForms: 5,
      aiInsightsPerMonth: 50,
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,              // daily
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: true,
      basicSeo: true,
      advancedSeo: true,
      brokenLinkScanning: true,     // weekly
      performanceMonitoring: true,  // every 12 hrs
      accessibilityMonitoring: true, // basic
      leadFormMonitoring: true,
      syntheticFormTests: false,
      bookingCheckoutMonitoring: false,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: true,   // manual approval only
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,                // daily + weekly + monthly
      aiIssueExplanations: true,
      aiPrioritization: true,       // limited
      aiBusinessSummaries: true,    // limited
      googleIntegrations: false,
      googleAnalytics: false,
      googleSearchConsole: false,
      googleBusinessProfile: false,
      wordpressConnect: true,
      marketplaceIntegrations: true,
      reputationMonitoring: false,
      competitorIntelligence: false,
      marketingIntelligence: false,
      multiClientDashboard: false,
      bulkScans: false,
      clientAccounts: false,
      roleBasedPermissions: true,   // basic
      apiAccess: false,
      agencyBranding: false,
      customLogo: false,
      removeGuardianBranding: false,
      customDashboardBranding: false,
      customDomain: false,
      brandedEmails: false,
      brandedReports: false,
      prioritySupport: false,       // standard
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ Pro ΓÇö $59 / mo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "PRO",
    name: "Pro",
    tagline: "Protect my leads and growth.",
    monthlyPriceCents: 5_900,
    annualPriceCents: 59_000,  // $590/yr
    hasTrial: true,
    trialCreditCardRequired: false,
    isPopular: true,
    limits: {
      maxWebsites: 10,
      maxBusinesses: 10,
      maxTeamMembers: 10,
      minFrequencyMinutes: 5,
      historyDays: 365,
      maxCriticalPages: 25,
      maxLeadForms: 20,
      aiInsightsPerMonth: 200,
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,              // daily
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: true,
      basicSeo: true,
      advancedSeo: true,
      brokenLinkScanning: true,     // weekly
      performanceMonitoring: true,  // every 6 hrs
      accessibilityMonitoring: true,
      leadFormMonitoring: true,
      syntheticFormTests: true,
      bookingCheckoutMonitoring: true,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: true,
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,
      aiIssueExplanations: true,
      aiPrioritization: true,
      aiBusinessSummaries: true,
      googleIntegrations: true,
      googleAnalytics: true,
      googleSearchConsole: true,
      googleBusinessProfile: true,
      wordpressConnect: true,
      marketplaceIntegrations: true,
      reputationMonitoring: true,
      competitorIntelligence: true, // limited
      marketingIntelligence: true,  // limited
      multiClientDashboard: false,
      bulkScans: false,
      clientAccounts: false,
      roleBasedPermissions: true,
      apiAccess: true,              // limited
      agencyBranding: false,
      customLogo: false,
      removeGuardianBranding: false,
      customDashboardBranding: false,
      customDomain: false,
      brandedEmails: false,
      brandedReports: false,
      prioritySupport: true,
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ Agency ΓÇö $99 / mo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "AGENCY",
    name: "Agency",
    tagline: "Manage all my clients.",
    monthlyPriceCents: 9_900,
    annualPriceCents: 99_000,  // $990/yr
    hasTrial: true,
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: 25,
      maxBusinesses: 25,
      maxTeamMembers: 15,
      minFrequencyMinutes: 5,
      historyDays: 365,
      maxCriticalPages: null,       // per client
      maxLeadForms: null,           // per client
      aiInsightsPerMonth: 500,      // shared pool
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: true,
      basicSeo: true,
      advancedSeo: true,
      brokenLinkScanning: true,     // weekly
      performanceMonitoring: true,  // every 6 hrs
      accessibilityMonitoring: true,
      leadFormMonitoring: true,
      syntheticFormTests: true,
      bookingCheckoutMonitoring: true,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: true,
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,
      aiIssueExplanations: true,
      aiPrioritization: true,
      aiBusinessSummaries: true,
      googleIntegrations: true,
      googleAnalytics: true,
      googleSearchConsole: true,
      googleBusinessProfile: true,
      wordpressConnect: true,
      marketplaceIntegrations: true,
      reputationMonitoring: true,
      competitorIntelligence: true,
      marketingIntelligence: true,
      multiClientDashboard: true,
      bulkScans: true,
      clientAccounts: true,
      roleBasedPermissions: true,
      apiAccess: true,
      agencyBranding: true,
      customLogo: true,
      removeGuardianBranding: false,
      customDashboardBranding: false,
      customDomain: false,
      brandedEmails: false,
      brandedReports: true,         // partial
      prioritySupport: true,
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ White Label ΓÇö $249 / mo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "WHITE_LABEL",
    name: "White Label",
    tagline: "Sell Guardian under my own brand.",
    monthlyPriceCents: 24_900,
    annualPriceCents: 249_000, // $2,490/yr
    hasTrial: true,
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: 100,
      maxBusinesses: 100,
      maxTeamMembers: 50,
      minFrequencyMinutes: 5,
      historyDays: 730,             // 24 months
      maxCriticalPages: null,       // per client
      maxLeadForms: null,           // per client
      aiInsightsPerMonth: 2_000,    // shared pool
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: true,
      basicSeo: true,
      advancedSeo: true,
      brokenLinkScanning: true,     // weekly
      performanceMonitoring: true,  // every 6 hrs
      accessibilityMonitoring: true,
      leadFormMonitoring: true,
      syntheticFormTests: true,
      bookingCheckoutMonitoring: true,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: true,
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,
      aiIssueExplanations: true,
      aiPrioritization: true,
      aiBusinessSummaries: true,
      googleIntegrations: true,
      googleAnalytics: true,
      googleSearchConsole: true,
      googleBusinessProfile: true,
      wordpressConnect: true,
      marketplaceIntegrations: true,
      reputationMonitoring: true,
      competitorIntelligence: true,
      marketingIntelligence: true,
      multiClientDashboard: true,
      bulkScans: true,
      clientAccounts: true,
      roleBasedPermissions: true,
      apiAccess: true,
      agencyBranding: true,
      customLogo: true,
      removeGuardianBranding: true,
      customDashboardBranding: true,
      customDomain: true,
      brandedEmails: true,
      brandedReports: true,
      prioritySupport: true,
      sla: false,
    },
  },

  // ΓöÇΓöÇΓöÇ Enterprise ΓÇö Custom ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Run digital operations at scale.",
    /** Price is negotiated ΓÇö 0 sentinel means "contact sales". */
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    hasTrial: false,             // negotiated
    trialCreditCardRequired: false,
    limits: {
      maxWebsites: Infinity,
      maxBusinesses: Infinity,
      maxTeamMembers: Infinity,
      minFrequencyMinutes: 1,    // 1ΓÇô5 min custom
      historyDays: Infinity,     // custom retention
      maxCriticalPages: null,    // custom
      maxLeadForms: null,        // custom
      aiInsightsPerMonth: null,  // custom
    },
    features: {
      continuousMonitoring: true,
      uptimeChecks: true,
      sslChecks: true,
      securityHeaders: true,
      dnsMonitoring: true,
      domainExpiryMonitoring: true,
      spfDmarcChecks: true,
      basicSeo: true,
      advancedSeo: true,
      brokenLinkScanning: true,
      performanceMonitoring: true,
      accessibilityMonitoring: true,
      leadFormMonitoring: true,
      syntheticFormTests: true,
      bookingCheckoutMonitoring: true,
      digitalHealthScore: true,
      issueDetection: true,
      businessImpactExplanation: true,
      fixRecommendations: true,
      automatedRemediation: true,
      inAppAlerts: true,
      emailAlerts: true,
      digests: true,
      aiIssueExplanations: true,
      aiPrioritization: true,
      aiBusinessSummaries: true,
      googleIntegrations: true,
      googleAnalytics: true,
      googleSearchConsole: true,
      googleBusinessProfile: true,
      wordpressConnect: true,
      marketplaceIntegrations: true,
      reputationMonitoring: true,
      competitorIntelligence: true,
      marketingIntelligence: true,
      multiClientDashboard: true,
      bulkScans: true,
      clientAccounts: true,
      roleBasedPermissions: true,
      apiAccess: true,
      agencyBranding: true,
      customLogo: true,
      removeGuardianBranding: true,
      customDashboardBranding: true,
      customDomain: true,
      brandedEmails: true,
      brandedReports: true,
      prioritySupport: true,     // dedicated
      sla: true,
    },
  },
] as const;

export type BillingPlanId = (typeof BILLING_PLANS)[number]["id"];

export type PlanDefinition = (typeof BILLING_PLANS)[number];

export function getPlanDefinition(id: string): PlanDefinition {
  const plan = BILLING_PLANS.find((p) => p.id === id);
  return plan ?? BILLING_PLANS[0];
}

export function billingPlanLabel(id: string): string {
  return getPlanDefinition(id).name;
}

export function getPlanLimits(id: string) {
  return getPlanDefinition(id).limits;
}

export function getPlanFeatures(id: string) {
  return getPlanDefinition(id).features;
}

export const TRIAL_DURATION_DAYS = 14;
