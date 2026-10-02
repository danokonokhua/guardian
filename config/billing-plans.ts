/** PRD section 19 plan catalog. Prices and entitlements await product configuration. */
export const BILLING_PLANS = [
  { id: "FREE", name: "Free" },
  { id: "STARTER", name: "Starter" },
  { id: "GROWTH", name: "Growth" },
  { id: "PRO", name: "Pro" },
  { id: "AGENCY", name: "Agency" },
  { id: "ENTERPRISE", name: "Enterprise" },
] as const;
export type BillingPlanId = (typeof BILLING_PLANS)[number]["id"];
export function billingPlanLabel(id: string): string {
  return BILLING_PLANS.find((plan) => plan.id === id)?.name ?? "Unknown plan";
}
