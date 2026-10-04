import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { DeveloperView } from "./developer-view";

export async function DeveloperDashboardPage() {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;

  if (!identity) {
    return (
      <main className="onboarding-content">
        <h1>Sign in to view Developer API Platform</h1>
        <Link href="/login" className="button-primary mt-6">
          Sign in
        </Link>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="onboarding-content">
        <h1>No active organization</h1>
      </main>
    );
  }

  return (
    <DashboardOrganizationProvider
      value={{
        organizationId: membership.organizationId,
        userId: identity.user.userId,
        email: identity.user.email,
        role: membership.role,
      }}
    >
      <DashboardShell
        title="Developer & API Platform"
        description="Programmatic REST API keys, SHA-256 tokens, OpenAPI specification, and rate-limited developer endpoints."
      >
        <DeveloperView key={membership.organizationId} organizationId={membership.organizationId} />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
