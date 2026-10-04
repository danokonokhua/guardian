"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/ui/brand";

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
    <div className="command-shell">
      <a className="command-skip" href="#command-content">
        Skip to dashboard content
      </a>
      <aside className="command-sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <strong>Business operations</strong>
          <span>{organization.role.toLowerCase()} access</span>
        </div>
        <a
          className="button-primary"
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
              ["/dashboard/integrations", "Integrations"],
              ["/dashboard/seo", "SEO intelligence"],
              ["/status-pages", "Client status pages"],
              ["/billing", "Plans & billing"],
              ["/seo", "SEO insights"],
              ["/security", "Security posture"],
              ["/revenue", "Lead-form health"],
              ["/reputation", "Reputation & reviews"],
              ["/competitors", "Competitor intelligence"],
              ["/marketing", "Marketing intelligence"],
              ["/agency", "Agency command center"],
              ["/remediation", "AutoFix remediation"],
              ["/developer", "Developer & API"],
              ["/mobile", "Mobile command"],
              ["/marketplace", "Marketplace & plugins"],
              ["/predictive", "Predictive intelligence"],
              ["/coo", "AI COO executive directives"],
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
          <form action="/api/auth/logout" method="POST" className="pt-2 border-t border-glass-subtle-border/40 mt-2">
            <button
              type="submit"
              className="w-full text-left text-xs font-medium text-neutral-400 hover:text-rose-400 py-1 transition-colors flex items-center gap-2"
            >
              <span aria-hidden="true" className="text-sm">⎋</span>
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="command-body">
        <header className="command-topbar">
          <span className="command-mobile-brand">
            <Brand />
          </span>
          <span className="command-breadcrumb">
            Workspace <span>/</span> Operations
          </span>
          <div className="flex items-center gap-3">
            <span className="operator-identity">
              {organization.email} · {organization.role.toLowerCase()}
            </span>
            <form action="/api/auth/logout" method="POST" className="inline-block">
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-400 hover:text-white bg-surface-container/60 hover:bg-surface-container border border-glass-subtle-border hover:border-glass-specular-border transition-all active:scale-95 shadow-sm"
              >
                <span>Sign out</span>
                <span aria-hidden="true" className="text-neutral-500 text-[10px]">↳</span>
              </button>
            </form>
          </div>
        </header>
        <main id="command-content" className="command-content">
          <nav className="command-mobile-shortcuts" aria-label="Workspace views">
            <Link href="/briefings">Briefing</Link>
            <Link href="/dashboard/integrations">Integrations</Link>
            <Link href="/reputation">Reputation</Link>
            <Link href="/status-pages">Status pages</Link>
            <Link href="/billing">Billing</Link>
            <Link href="/dashboard/executive">Executive</Link>
            <Link href="/onboarding">Connect website</Link>
            <form action="/api/auth/logout" method="POST" className="inline">
              <button
                type="submit"
                className="text-xs text-neutral-400 hover:text-rose-400 py-1 px-2"
              >
                Sign out
              </button>
            </form>
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
