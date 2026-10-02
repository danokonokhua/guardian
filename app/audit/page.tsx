import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground, GlassCard } from "@/components/ui";
import AuditForm from "@/app/audit/audit-form";

export const metadata = {
  title: "Free website audit — Guardian AI",
  description: "Run a bounded Guardian health audit of your public website with Apple-grade precision.",
};

export default function AuditPage() {
  return (
    <main className="min-h-screen px-4 sm:px-6 py-12 relative flex flex-col justify-center items-center">
      <AmbientBackground variant="audit" />

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full font-headline text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-full font-headline text-xs font-semibold text-on-primary-container bg-primary-container hover:brightness-110 shadow-[0_0_16px_rgba(0,240,255,0.3)] transition-all"
            >
              Create Workspace →
            </Link>
          </div>
        </header>

        <GlassCard glow="cyan" variant="elevated" className="p-8 sm:p-12 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-container/10 border border-primary-container/25 text-primary-container font-mono text-xs mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_#00F0FF] animate-pulse" />
            <span>PRD SECTION 9 • ACQUISITION ENGINE</span>
          </div>

          <h1 className="font-headline text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            See What Is Silently{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
              Affecting Your Business.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-on-surface-variant">
            Guardian runs a live diagnostic of your public website checking availability, server
            latency, critical lead channels, and security hygiene in seconds. No credit card or account
            required.
          </p>

          <AuditForm />
        </GlassCard>
      </div>
    </main>
  );
}
