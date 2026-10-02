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

/** Asserts an organization plan has access to Google Integrations (PRO, AGENCY, WHITE_LABEL, ENTERPRISE). */
export function assertCanUseGoogleIntegrations(planId: string): void {
  assertCanUseFeature(planId, "googleIntegrations");
}

