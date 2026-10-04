import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground } from "@/components/ui/ambient-background";
import AuditForm from "@/app/audit/audit-form";

export const metadata = {
  title: "Free Website Audit — Guardian",
  description:
    "Run an instant, bounded health and revenue leak audit of your public website. No credit card or account required.",
};

export default function AuditPage() {
  return (
    <div className="relative min-h-screen bg-[#0A0D14] text-foreground selection:bg-[#00F0FF]/20 selection:text-[#00F0FF]">
      <AmbientBackground variant="audit" />

      {/* Floating Top Navigation Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between px-6 py-3.5 rounded-full border border-white/10 bg-[#0E131F]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Brand />
          <nav className="flex items-center gap-6" aria-label="Main navigation">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Platform
            </Link>
            <Link
              href="/pricing"
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/#faq"
              className="hidden md:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              FAQs
            </Link>
            <Link
              href="/contact"
              className="hidden sm:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Contact Sales
            </Link>
            <Link
              href="/login"
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-[#38F4FF] hover:shadow-[0_0_28px_rgba(0,240,255,0.6)] active:scale-95 transition-all"
            >
              <span>Get started</span>
              <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-10 sm:pt-14 pb-20">
        {/* Navigation Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-[#00F0FF] transition-colors"
          >
            ← Back to homepage
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-10 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 backdrop-blur-md mb-4">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              Instant Website Audit
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            See what is silently affecting your website.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-neutral-300 mb-8">
            Guardian inspects real-time availability, server response latency, SSL/security
            configuration, and essential SEO discoverability in one bounded snapshot. No signup or
            credit card required.
          </p>
          <AuditForm />
        </section>
      </main>
    </div>
  );
}
