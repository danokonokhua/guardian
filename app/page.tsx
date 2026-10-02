import Link from "next/link";
import AuditForm from "@/app/audit/audit-form";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusCapsule } from "@/components/ui/status-capsule";

const features = [
  {
    n: "01",
    title: "Protect your digital front door.",
    text: "Monitor uptime, SSL certificates, broken links, and critical lead forms. Find the silent failures that prevent customers from reaching you.",
    tags: ["Website availability", "Lead-form checks", "SSL lifecycle"],
  },
  {
    n: "02",
    title: "Understand what needs attention.",
    text: "Turn complex telemetry into an explainable Digital Health Index, historical incident timelines, and grounded plain-English recommendations.",
    tags: ["Digital health score", "Prioritized issues", "SLA tracking"],
  },
  {
    n: "03",
    title: "Build on a healthier foundation.",
    text: "Audit essential SEO signals, TTFB latency, server responsiveness, and security hygiene. Give your team an unambiguous roadmap to improve.",
    tags: ["SEO vitals", "Security hygiene", "Response latency"],
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-canvas text-foreground selection:bg-primary/20 selection:text-primary">
      <AmbientBackground variant="audit" />

      {/* Frosted Glass Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-glass-specular-border bg-canvas/60">
        <Brand />
        <nav aria-label="Main navigation" className="flex items-center gap-6">
          <a
            href="#features"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Platform
          </a>
          <Link
            href="/pricing"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/audit"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Free audit
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-neutral-950 shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main id="main-content" className="relative z-10 max-w-6xl mx-auto px-6 py-16 space-y-24">
        {/* Apple-grade Luminous Hero Section */}
        <section className="text-center max-w-4xl mx-auto pt-8">
          <div className="flex justify-center mb-6">
            <StatusCapsule status="operational" label="DIGITAL BUSINESS OPERATIONS" />
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
            Never let another
            <br />
            silent revenue leak{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent-violet">
              go undetected.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Your website can be online while your business is losing opportunities. Discover what is
            broken, understand the business impact, and know exactly what to fix next.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <a
              href="#free-audit"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider bg-primary text-neutral-950 shadow-xl shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <span>Check my website</span>
              <span aria-hidden="true">↗</span>
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-medium text-white bg-surface-elevated/80 hover:bg-neutral-800 border border-glass-specular-border active:scale-95 backdrop-blur-xl transition-all shadow-md"
            >
              Create your workspace
            </Link>
          </div>

          {/* Frosted Telemetry Details Strip */}
          <div className="inline-flex flex-wrap items-center justify-center gap-6 px-6 py-3 rounded-full bg-surface-lowest/70 backdrop-blur-xl border border-glass-specular-border shadow-lg text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Website monitoring
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-status-operational" />
              Lead-form health
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-violet" />
              Actionable insights
            </span>
          </div>
        </section>

        {/* Free Website Audit Section */}
        <section className="scroll-mt-24" id="free-audit">
          <GlassCard variant="elevated" glow="cyan" className="p-8 sm:p-12">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
                YOUR FIRST HEALTH CHECK
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 bg-surface-lowest/80 border border-glass-specular-border px-3 py-1 rounded-full">
                NO ACCOUNT REQUIRED
              </span>
            </div>

            <div className="flex items-start gap-4 mb-8">
              <span className="text-3xl text-primary font-light" aria-hidden="true">
                ◎
              </span>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                  Is your digital business actually working?
                </h2>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                  Start with a free website audit. Get an instant snapshot of availability, response
                  time, SEO signals, and security hygiene.
                </p>
              </div>
            </div>

            <AuditForm />

            <p className="text-xs text-neutral-500 mt-6 font-mono">
              A real snapshot of your public website. Results show what was measured and where
              coverage is limited.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-8 border-t border-glass-specular-border">
              {[
                "01 / AVAILABILITY",
                "02 / RESPONSE TIME",
                "03 / SEO BASICS",
                "04 / SECURITY HYGIENE",
              ].map((item) => (
                <div
                  key={item}
                  className="px-3 py-2 rounded-xl bg-surface-lowest/50 border border-glass-specular-border/50 text-[11px] font-mono text-neutral-400 text-center"
                >
                  {item}
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* Feature Cards Grid */}
        <section className="scroll-mt-24" id="features">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
              PROTECT · UNDERSTAND · GROW
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3 mb-4">
              Clarity for the systems your business depends on.
            </h2>
            <p className="text-neutral-400 text-base">
              Less guesswork. More visibility into what needs your immediate attention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <GlassCard
                key={f.n}
                variant="elevated"
                glow="none"
                className="p-8 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300"
              >
                <div>
                  <span className="text-xs font-mono text-primary font-bold tracking-wider">
                    {f.n} / GUARDIAN
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight mt-3 mb-3">
                    {f.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-6">{f.text}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 border-t border-glass-specular-border">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-surface-lowest/70 border border-glass-specular-border text-neutral-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Action Workflow Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
              FROM SIGNAL TO NEXT STEP
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3 mb-4">
              A clearer path from issue to action.
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed mb-6">
              See the evidence behind each finding, understand its business impact, and prioritize
              what your team should address first.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Bring your operations together <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="space-y-4">
            {[
              { n: "01", step: "Monitor your website", sub: "Continuous uptime, SSL, and form telemetry" },
              { n: "02", step: "Understand the findings", sub: "Plain-English impact analysis grounded in evidence" },
              { n: "03", step: "Prioritize your next action", sub: "Step-by-step remediation guide for your developers" },
            ].map((item) => (
              <GlassCard
                key={item.n}
                className="p-6 flex items-center justify-between hover:border-primary/40 transition-all duration-300 group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono font-bold text-primary px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                    {item.n}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-primary transition-colors">
                      {item.step}
                    </h3>
                    <p className="text-xs text-neutral-400">{item.sub}</p>
                  </div>
                </div>
                <span className="text-neutral-500 group-hover:text-primary group-hover:translate-x-1 transition-all" aria-hidden="true">
                  ↗
                </span>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section>
          <GlassCard variant="elevated" glow="violet" className="text-center p-12 sm:p-16">
            <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
              YOUR BUSINESS DESERVES VISIBILITY
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mt-3 mb-4">
              Stop guessing. Start understanding.
            </h2>
            <p className="text-neutral-400 text-base max-w-xl mx-auto mb-8 leading-relaxed">
              Your first website health check takes under 30 seconds and requires no account.
            </p>
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider bg-primary text-neutral-950 shadow-xl shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
            >
              Run a free audit <span aria-hidden="true">↗</span>
            </Link>
          </GlassCard>
        </section>
      </main>

      {/* Frosted Footer */}
      <footer className="relative z-10 border-t border-glass-specular-border mt-24 py-12 px-6 backdrop-blur-xl bg-canvas/60">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Brand />
          <p className="text-xs text-neutral-400 font-mono">
            Protect. Understand. Grow. · Times shown in UTC
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Sign in to your workspace ↗
          </Link>
        </div>
      </footer>
    </div>
  );
}
