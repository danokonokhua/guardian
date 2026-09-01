"use client";

import { createContext, useContext, type ReactNode } from "react";

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

export function DashboardShell({ children }: { children: ReactNode }) {
  const organization = useDashboardOrganization();
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
              Guardian dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operations overview</h1>
            <p className="mt-2 text-sm text-neutral-400">
              {organization.email} · {organization.role.toLowerCase()}
            </p>
          </div>
          <nav aria-label="Dashboard navigation" className="flex gap-2 text-sm">
            <a
              className="rounded-md px-3 py-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              href="/dashboard"
            >
              Overview
            </a>
            <a
              className="rounded-md px-3 py-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              href="#health"
            >
              Health
            </a>
            <a
              className="rounded-md bg-neutral-800 px-3 py-2 text-neutral-100"
              href="#notifications"
            >
              Notifications
            </a>
            <a
              className="rounded-md px-3 py-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              href="#monitoring"
            >
              Monitoring
            </a>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
