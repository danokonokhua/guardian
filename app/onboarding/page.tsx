import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { Brand } from "@/components/ui/brand";
import { WebsiteOnboarding } from "./website-onboarding";
export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const membership = user ? (await listCurrentUserMemberships())[0] : undefined;
  return (
    <div>
      <header className="public-header">
        <Brand />
        <Link href="/dashboard" className="quiet-link">
          Back to dashboard
        </Link>
      </header>
      {!user ? (
        <main className="onboarding-content">
          <h1>Sign in to connect your website</h1>
          <Link href="/login" className="button-primary">
            Sign in
          </Link>
        </main>
      ) : !membership ? (
        <main className="onboarding-content">
          <h1>No active organization</h1>
        </main>
      ) : (
        <WebsiteOnboarding
          key={membership.organizationId}
          organizationId={membership.organizationId}
          canCreate={can(membership.role, "website:create")}
          canVerify={can(membership.role, "website:scan")}
        />
      )}
    </div>
  );
}
