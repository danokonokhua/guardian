import Link from "next/link";
import AuditForm from "@/app/audit/audit-form";
import { Brand } from "@/components/ui/brand";
import { GlassCard } from "@/components/ui/glass-card";

const features = [
  {
    n: "01",
    title: "Protect your digital front door.",
    text: "Monitor uptime, SSL, broken links, and critical lead forms. Find the failures that can keep customers from reaching you.",
    tags: ["Website availability", "Lead-form checks"],
  },
  {
    n: "02",
    title: "Understand what needs attention.",
    text: "Turn monitoring results into an explainable health score, issue history, and grounded recommendations.",
    tags: ["Digital health score", "Prioritized issues"],
  },
  {
    n: "03",
    title: "Build on a healthier foundation.",
    text: "Check essential SEO, server response time, and security hygiene. Give your team a clear place to start improving.",
    tags: ["Basic SEO", "Security hygiene"],
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#0A0D14] text-neutral-100 overflow-hidden font-sans selection:bg-[#00F0FF]/30 selection:text-[#00F0FF]">
      {/* Dynamic Background Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#00F0FF]/15 to-transparent rounded-full blur-[120px] -z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-40 w-[600px] h-[600px] bg-gradient-to-b from-[#6807ba]/20 to-transparent rounded-full blur-[140px] -z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-1/4 -left-40 w-[600px] h-[600px] bg-gradient-to-b from-[#00F0FF]/10 to-transparent rounded-full blur-[140px] -z-10"
        aria-hidden="true"
      />

      {/* Floating Frosted Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between px-6 py-3.5 rounded-full border border-white/10 bg-[#0E131F]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Brand />
          <nav className="flex items-center gap-6" aria-label="Main navigation">
            <a
              href="#features"
              className="hidden md:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Platform
            </a>
            <Link
              href="/audit"
              className="hidden sm:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Free audit
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

      <main id="main-content" className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20 space-y-24 sm:space-y-32">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-300 font-medium">
              Digital Business Operations
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Never let another
            <br />
            silent revenue leak
            <br />
            <span className="italic font-serif text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-white to-[#6807ba]">
              go undetected.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl mx-auto mb-10">
            Your website can be online while your business is losing opportunities. Discover what is
            broken, understand the impact, and know what to fix next.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a
              href="#free-audit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_24px_rgba(0,240,255,0.45)] hover:bg-[#38F4FF] hover:shadow-[0_0_32px_rgba(0,240,255,0.65)] active:scale-95 transition-all"
            >
              <span>Check my website</span>
              <span aria-hidden="true">↗</span>
            </a>
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold tracking-wide bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30 active:scale-95 transition-all backdrop-blur-md shadow-sm"
            >
              Create your workspace
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" /> Website monitoring
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" /> Lead-form health
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" /> Actionable insights
            </span>
          </div>
        </section>

        {/* Free Audit Preview Card */}
        <section className="scroll-mt-24" id="free-audit">
          <GlassCard variant="elevated" glow="cyan" className="p-8 sm:p-12 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
                YOUR FIRST HEALTH CHECK
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                NO ACCOUNT REQUIRED
              </span>
            </div>

            <div className="flex items-start gap-4 mb-8">
              <span className="text-3xl text-[#00F0FF] font-light" aria-hidden="true">
                ◎
              </span>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                  Is your digital business actually working?
                </h2>
                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                  Start with a free website audit. Get an instant snapshot of availability, response
                  time, SEO signals, and security hygiene.
                </p>
              </div>
            </div>

            <AuditForm />

            <p className="text-xs text-neutral-400 mt-6 font-mono">
              A real snapshot of your public website. Results show what was measured and where
              coverage is limited.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-8 border-t border-white/10">
              {[
                "01 / AVAILABILITY",
                "02 / RESPONSE TIME",
                "03 / SEO BASICS",
                "04 / SECURITY HYGIENE",
              ].map((item) => (
                <div
                  key={item}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300 text-center"
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
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              PROTECT · UNDERSTAND · GROW
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3 mb-4">
              Clarity for the systems your business depends on.
            </h2>
            <p className="text-neutral-300 text-base">
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
                  <span className="text-xs font-mono text-[#00F0FF] font-bold tracking-wider">
                    {f.n} / GUARDIAN
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight mt-3 mb-3">
                    {f.title}
                  </h3>
                  <p className="text-sm text-neutral-300 leading-relaxed mb-6">{f.text}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-200"
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
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              FROM SIGNAL TO NEXT STEP
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3 mb-4">
              A clearer path from issue to action.
            </h2>
            <p className="text-neutral-300 text-base leading-relaxed mb-6">
              See the evidence behind each finding, understand its business impact, and prioritize
              what your team should address first.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00F0FF] hover:text-[#38F4FF] transition-colors"
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
                className="p-6 flex items-center justify-between hover:border-[#00F0FF]/40 transition-all duration-300 group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono font-bold text-[#00F0FF] px-3 py-1.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/25">
                    {item.n}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-[#00F0FF] transition-colors">
                      {item.step}
                    </h3>
                    <p className="text-xs text-neutral-400">{item.sub}</p>
                  </div>
                </div>
                <span className="text-neutral-400 group-hover:text-[#00F0FF] group-hover:translate-x-1 transition-all" aria-hidden="true">
                  ↗
                </span>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section>
          <GlassCard variant="elevated" glow="violet" className="text-center p-12 sm:p-16">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              YOUR BUSINESS DESERVES VISIBILITY
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mt-3 mb-4">
              Stop guessing. Start understanding.
            </h2>
            <p className="text-neutral-300 text-base max-w-xl mx-auto mb-8 leading-relaxed">
              Your first website health check takes under 30 seconds and requires no account.
            </p>
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_24px_rgba(0,240,255,0.45)] hover:bg-[#38F4FF] hover:shadow-[0_0_32px_rgba(0,240,255,0.65)] active:scale-95 transition-all"
            >
              Run a free audit <span aria-hidden="true">↗</span>
            </Link>
          </GlassCard>
        </section>
      </main>

      {/* Frosted Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-24 py-12 px-6 backdrop-blur-xl bg-[#0A0D14]/75">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Brand />
          <p className="text-xs text-neutral-400 font-mono">
            Protect. Understand. Grow. · Times shown in UTC
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-neutral-300 hover:text-white transition-colors"
          >
            Sign in to your workspace ↗
          </Link>
        </div>
      </footer>
    </div>
  );
}
