import { getPlanDefinition, getPlanLimits, getPlanFeatures } from "@/config/billing-plans";
import { ForbiddenError } from "@/lib/errors";

export interface OrganizationUsage {
  plan: string;
  websitesCount: number;
  websitesLimit: number;
  businessesCount: number;
  businessesLimit: number;
  membersCount: number;
  membersLimit: number;
  isTrialing: boolean;
  daysRemainingInTrial: number | null;
}

/** Asserts an organization has quota to add a website. */
export function assertCanAddWebsite(currentCount: number, planId: string): void {
  const limits = getPlanLimits(planId);
  if (currentCount >= limits.maxWebsites) {
    const plan = getPlanDefinition(planId);
    throw new ForbiddenError(
      `Website limit reached (${currentCount}/${limits.maxWebsites} on the ${plan.name} plan). Upgrade your plan to add more websites.`,
    );
  }
}

/** Asserts an organization has quota to add a business. */
export function assertCanAddBusiness(currentCount: number, planId: string): void {
  const limits = getPlanLimits(planId);
  if (currentCount >= limits.maxBusinesses) {
    const plan = getPlanDefinition(planId);
    throw new ForbiddenError(
      `Business profile limit reached (${currentCount}/${limits.maxBusinesses} on the ${plan.name} plan). Upgrade your plan to add more businesses.`,
    );
  }
}

/** Asserts an organization has quota to invite a new team member. */
export function assertCanAddMember(currentCount: number, planId: string): void {
  const limits = getPlanLimits(planId);
  if (currentCount >= limits.maxTeamMembers) {
    const plan = getPlanDefinition(planId);
    throw new ForbiddenError(
      `Team seat limit reached (${currentCount}/${limits.maxTeamMembers} on the ${plan.name} plan). Upgrade your plan to invite more team members.`,
    );
  }
}

/** Asserts an organization plan has access to a specific feature. */
export function assertCanUseFeature(
  planId: string,
  featureName: keyof ReturnType<typeof getPlanFeatures>,
): void {
  const features = getPlanFeatures(planId);
  if (!features[featureName]) {
    const plan = getPlanDefinition(planId);
    throw new ForbiddenError(
      `The ${String(featureName)} capability is not available on the ${plan.name} plan. Upgrade your plan to access this feature.`,
    );
  }
}

// ─── Convenience feature guards ─────────────────────────────────────────────

/** PRO, AGENCY, WHITE_LABEL, ENTERPRISE only. */
export function assertCanUseGoogleIntegrations(planId: string): void {
  assertCanUseFeature(planId, "googleIntegrations");
}

/** GROWTH+ only. */
export function assertCanUseAdvancedSeo(planId: string): void {
  assertCanUseFeature(planId, "advancedSeo");
}

/** PRO+ only. */
export function assertCanUseSyntheticFormTests(planId: string): void {
  assertCanUseFeature(planId, "syntheticFormTests");
}

/** PRO+ only. */
export function assertCanUseBookingMonitoring(planId: string): void {
  assertCanUseFeature(planId, "bookingCheckoutMonitoring");
}

/** PRO+ only. */
export function assertCanUseReputationMonitoring(planId: string): void {
  assertCanUseFeature(planId, "reputationMonitoring");
}

/** AGENCY+ only. */
export function assertCanUseMultiClientDashboard(planId: string): void {
  assertCanUseFeature(planId, "multiClientDashboard");
}

/** PRO+ only (limited on PRO, full on AGENCY+). */
export function assertCanUseApiAccess(planId: string): void {
  assertCanUseFeature(planId, "apiAccess");
}

/** WHITE_LABEL, ENTERPRISE only. */
export function assertCanRemoveGuardianBranding(planId: string): void {
  assertCanUseFeature(planId, "removeGuardianBranding");
}

/** ENTERPRISE only. */
export function assertHasSla(planId: string): void {
  assertCanUseFeature(planId, "sla");
}

/** Returns the monthly AI insight quota for a plan (null = custom/unlimited). */
export function getAiInsightsQuota(planId: string): number | null {
  return getPlanLimits(planId).aiInsightsPerMonth;
}
