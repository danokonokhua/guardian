import Link from "next/link";
import { getCurrentUser, listCurrentUserMemberships } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { WebsiteOnboarding } from "./website-onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const membership = user ? (await listCurrentUserMemberships())[0] : undefined;
  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      <AmbientBackground variant="dashboard" />
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-glass-specular-border bg-canvas/60">
        <Brand />
        <Link href="/dashboard" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">
          Back to dashboard
        </Link>
      </header>
      <div className="relative z-10">
        {!user ? (
          <main className="onboarding-content">
            <h1>Sign in to connect your website</h1>
            <Link href="/login" className="button-primary mt-6">
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
    </div>
  );
}
