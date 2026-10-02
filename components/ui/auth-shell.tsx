import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "./brand";
import { AmbientBackground } from "./ambient-background";
import { GlassCard } from "./glass-card";

export function AuthShell({ children, signup = false }: { children: ReactNode; signup?: boolean }) {
  return (
    <main className={`min-h-screen relative flex flex-col justify-between overflow-hidden bg-surface ${signup ? "auth-signup" : ""}`}>
      <AmbientBackground variant="audit" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-12 border-b border-glass-subtle-border">
        <Brand />
        <Link
          href="/audit"
          className="text-xs font-mono text-primary-fixed-dim hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container/60 border border-glass-subtle-border"
        >
          <span>Run free audit</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className={`w-full flex items-center justify-center gap-16 max-w-6xl ${signup ? "lg:justify-between" : ""}`}>
          {signup && (
            <aside className="hidden lg:flex flex-col max-w-lg space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/10 border border-primary-container/20 text-primary-container font-mono text-xs w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                <span>AUTONOMOUS OPERATIONS</span>
              </div>
              <h1 className="font-headline text-4xl sm:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                Never let another silent revenue leak{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
                  go undetected.
                </span>
              </h1>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Connect your website, lead forms, and digital vitals into an intelligent operations cockpit with real-time incident resolution.
              </p>

              <GlassCard variant="default" className="p-6 space-y-4">
                <span className="font-mono text-xs uppercase tracking-wider text-outline">
                  AUTONOMOUS SAFEGUARDS
                </span>
                {[
                  "24/7 Global Uptime & Latency Probes",
                  "Mystery Shopper Lead-Form Verification",
                  "Automated Business Risk & SLA Scoring",
                ].map((s, i) => (
                  <div className="flex items-center justify-between text-sm text-on-surface p-2.5 rounded-xl bg-surface-container/40" key={s}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-primary-container w-5 h-5 rounded-full bg-primary-container/10 flex items-center justify-center">
                        0{i + 1}
                      </span>
                      <span>{s}</span>
                    </div>
                    <span className="text-primary-container text-xs" aria-hidden="true">✓</span>
                  </div>
                ))}
              </GlassCard>
            </aside>
          )}

          <GlassCard glow="cyan" variant="elevated" className="w-full max-w-md p-8 sm:p-10">
            {children}
          </GlassCard>
        </div>
      </div>

      <footer className="relative z-10 flex flex-wrap items-center justify-between px-6 py-4 sm:px-12 border-t border-glass-subtle-border text-xs font-mono text-outline">
        <span>Guardian • Autonomous Digital Operations</span>
        <span className="text-on-surface-variant">Protect • Understand • Grow</span>
      </footer>
    </main>
  );
}
