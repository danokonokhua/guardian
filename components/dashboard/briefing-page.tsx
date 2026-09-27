import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { ExecutiveBriefing } from "./executive-briefing";
export async function BriefingPage({ executive = false }: { executive?: boolean }) {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;
  if (!identity)
    return (
      <main className="onboarding-content">
        <h1>Sign in to view your briefing</h1>
        <Link href="/login" className="button-primary mt-6">
          Sign in
        </Link>
      </main>
    );
  if (!membership)
    return (
      <main className="onboarding-content">
        <h1>No active organization</h1>
      </main>
    );
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
        title={executive ? "Executive Command Center" : "Operational Briefing"}
        description="Your digital health, current priorities, and evidence-backed next steps."
      >
        <ExecutiveBriefing
          key={membership.organizationId}
          organizationId={membership.organizationId}
          executive={executive}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
