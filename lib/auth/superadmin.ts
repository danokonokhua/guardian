/**
 * Platform Superadmin & Elevated Testing Access Configuration.
 *
 * Superadmins automatically receive:
 * - Role: OWNER across all organizations
 * - Plan: ENTERPRISE with active subscription
 * - All RBAC permissions (org:*, member:*, website:*, monitoring:*, etc.)
 * - All feature entitlements (SEO, Security, Google, AutoFix, AI COO, Agency, API, etc.)
 * - Unlimited limits (websites, businesses, team members, rate limits)
 */

export const SUPERADMIN_EMAILS: ReadonlySet<string> = new Set(["danielokonokhua@gmail.com"]);

/**
 * Checks whether an email address is configured with highest-level platform access.
 */
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (SUPERADMIN_EMAILS.has(normalized)) {
    return true;
  }
  const envAdmin = process.env.GUARDIAN_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(envAdmin && envAdmin === normalized);
}
