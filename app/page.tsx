/**
 * Phase 1B development landing page.
 *
 * Public landing page. Authenticated users can enter the dashboard at
 * `/dashboard`; this page never selects or exposes an organization.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-10 text-center shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
          Digital Business Operations Platform
        </p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight">Guardian</h1>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-300">
            Phase 1B Foundation
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1 text-emerald-300">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
            Status: Operational
          </span>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-neutral-400">
          Foundation services are operational. Sign in to access your organization dashboard.
        </p>

        <p className="mt-6 font-mono text-xs text-neutral-500">
          liveness probe: <span className="text-neutral-300">GET /api/health</span>
        </p>
      </section>
    </main>
  );
}
