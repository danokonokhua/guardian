import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { DashboardOrganizationProvider, DashboardShell } from "./dashboard-shell";
import { MonitoringViewPanel, type MonitoringView } from "./monitoring-view";
const titles: Record<MonitoringView, string> = {
  health: "Digital Health Vitals",
  seo: "SEO Insights",
  security: "Security Posture",
  revenue: "Lead-form Health",
  reputation: "Reputation & Review Intelligence",
};
export async function MonitoringPage({ view }: { view: MonitoringView }) {
  const identity = await getCurrentUser();
  const membership = identity ? (await listCurrentUserMemberships())[0] : undefined;
  if (!identity)
    return (
      <main className="onboarding-content">
        <h1>Sign in to view monitoring</h1>
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
        role: membership.role,
        email: identity.user.email,
      }}
    >
      <DashboardShell
        title={titles[view]}
        description="Evidence from your configured monitoring checks, with clear next steps."
      >
        <MonitoringViewPanel
          key={membership.organizationId}
          organizationId={membership.organizationId}
          view={view}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
