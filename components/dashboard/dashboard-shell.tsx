"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { StatusCapsule } from "@/components/ui/status-capsule";

export interface DashboardOrganization {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly email: string;
}

const DashboardOrganizationContext = createContext<DashboardOrganization | null>(null);

export function DashboardOrganizationProvider({
  value,
  children,
}: {
  value: DashboardOrganization;
  children: ReactNode;
}) {
  return (
    <DashboardOrganizationContext.Provider value={value}>
      {children}
    </DashboardOrganizationContext.Provider>
  );
}

export function useDashboardOrganization(): DashboardOrganization {
  const value = useContext(DashboardOrganizationContext);
  if (value === null) {
    throw new Error("useDashboardOrganization must be used within DashboardOrganizationProvider");
  }
  return value;
}

const destinations = [
  { href: "/dashboard#overview", label: "Overview", icon: "◈" },
  { href: "/health", label: "Digital health", icon: "◎" },
  { href: "/dashboard#monitoring", label: "Monitoring", icon: "⌁" },
  { href: "/settings/alerts", label: "Notifications", icon: "◇" },
];
export function DashboardShell({
  children,
  title = "Operations Command Center",
  description = "Understand your health. Prioritize issues. Keep your business moving.",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const organization = useDashboardOrganization();
  const pathname = usePathname();
  const [active, setActive] = useState(
    pathname === "/dashboard" ? "/dashboard#overview" : pathname,
  );
  return (
    <div className="command-shell relative overflow-hidden">
      <AmbientBackground variant="dashboard" />
      <a className="command-skip" href="#command-content">
        Skip to dashboard content
      </a>
      <aside className="command-sidebar relative z-10 backdrop-blur-2xl bg-surface-container-lowest/80 border-r border-glass-subtle-border">
        <Brand />
        <div className="workspace-label rounded-2xl bg-surface-container-low/75 border border-glass-specular-border p-3.5 shadow-sm">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <strong>Business operations</strong>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-mono">{organization.role.toLowerCase()}</span>
            <StatusCapsule status="operational" label="Live" pulse className="py-0.5 px-2 text-[10px]" />
          </div>
        </div>
        <a
          className="button-primary text-center"
          href="/dashboard#monitoring"
          onClick={() => setActive("/dashboard#monitoring")}
        >
          + Manage monitoring
        </a>
        <p className="sidebar-caption">OPERATIONS</p>
        <nav aria-label="Dashboard navigation">
          {destinations.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "location" : undefined}
              onClick={() => setActive(item.href)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Monitoring views">
          {(
            [
              ["/dashboard/executive", "Executive overview"],
              ["/briefings", "Operational briefing"],
              ["/status-pages", "Client status pages"],
              ["/billing", "Plans & billing"],
              ["/seo", "SEO insights"],
              ["/security", "Security posture"],
              ["/revenue", "Lead-form health"],
            ] as const
          ).map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="eyebrow">PROTECT · UNDERSTAND · GROW</span>
            <p>
              Evidence behind every finding.
              <br />
              Clarity for your next decision.
            </p>
          </div>
          <Link href="/onboarding" className="quiet-link">
            Connect a website
          </Link>
          <a href="/audit">Run a free website audit ↗</a>
          <Link href="/">Back to homepage ↗</Link>
        </div>
      </aside>
      <div className="command-body relative z-10">
        <header className="command-topbar backdrop-blur-2xl bg-surface-container-lowest/80 border-b border-glass-subtle-border">
          <span className="command-mobile-brand">
            <Brand />
          </span>
          <span className="command-breadcrumb">
            Workspace <span>/</span> Operations
          </span>
          <div className="flex items-center gap-3">
            <span className="operator-identity font-mono text-xs px-3 py-1 rounded-full bg-surface-container/60 border border-glass-subtle-border">
              {organization.email} · {organization.role.toLowerCase()}
            </span>
          </div>
        </header>
        <main id="command-content" className="command-content">
          <nav className="command-mobile-shortcuts" aria-label="Workspace views">
            <Link href="/briefings">Briefing</Link>
            <Link href="/status-pages">Status pages</Link>
            <Link href="/billing">Billing</Link>
            <Link href="/dashboard/executive">Executive</Link>
            <Link href="/onboarding">Connect website</Link>
          </nav>
          <div className="command-heading" id="overview">
            <div>
              <span className="eyebrow">YOUR DIGITAL BUSINESS, IN VIEW</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <a
              href="/dashboard#monitoring"
              className="button-secondary compact"
              onClick={() => setActive("/dashboard#monitoring")}
            >
              Manage checks ↗
            </a>
          </div>
          {children}
        </main>
        <footer className="command-footer">
          Guardian · Digital business operations<span>Monitor → Understand → Act</span>
        </footer>
      </div>
      <nav className="command-mobile-nav" aria-label="Mobile dashboard navigation">
        {destinations.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={active === item.href ? "location" : undefined}
            onClick={() => setActive(item.href)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
