import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import {
  DashboardOrganizationProvider,
  DashboardShell,
} from "@/components/dashboard/dashboard-shell";
import { StatusManager } from "@/components/status-pages/status-manager";
import "@/components/status-pages/status-pages.css";
export const dynamic = "force-dynamic";
export default async function StatusPages() {
  const identity = await getCurrentUser();
  if (!identity)
    return (
      <main className="onboarding-content">
        <h1>Sign in to view status pages</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  const membership = (await listCurrentUserMemberships())[0];
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
        title="Client Status Pages"
        description="Share approved service updates with your clients. Keep internal diagnostics private."
      >
        <StatusManager
          organizationId={membership.organizationId}
          canManage={can(membership.role, "org:update")}
        />
      </DashboardShell>
    </DashboardOrganizationProvider>
  );
}
