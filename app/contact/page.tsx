"use client";

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { GlassCard } from "@/components/ui/glass-card";

function ContactFormInner() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") || "ENTERPRISE";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [plan, setPlan] = useState(
    initialPlan === "ENTERPRISE"
      ? "Enterprise Custom Plan"
      : initialPlan === "AGENCY"
        ? "Agency White-Label Plan"
        : "Custom Solution",
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          website: website || undefined,
          plan,
          message,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit inquiry. Please try again.");
      }

      setSuccessMessage(
        data?.message ||
          "Thank you for contacting us! An operations specialist will reach out within 24 hours.",
      );
      setName("");
      setEmail("");
      setCompany("");
      setWebsite("");
      setMessage("");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassCard variant="elevated" glow="cyan" className="p-8 sm:p-12 relative overflow-hidden">
      {successMessage ? (
        <div className="py-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] text-3xl flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(0,240,255,0.4)]">
            ✓
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Inquiry Received
          </h2>
          <p className="text-neutral-300 max-w-lg mx-auto leading-relaxed text-sm sm:text-base">
            {successMessage}
          </p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all"
            >
              Return to Homepage
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-[#38F4FF] transition-all"
            >
              View Pricing Tiers ↗
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              SALES & ENTERPRISE INQUIRY
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              SLA GUARANTEES AVAILABLE
            </span>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
              >
                Full Name <span className="text-[#00F0FF]">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
              >
                Work Email <span className="text-[#00F0FF]">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="contact-company"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
              >
                Company Name
              </label>
              <input
                id="contact-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="contact-website"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
              >
                Primary Website URL
              </label>
              <input
                id="contact-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-plan"
              className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
            >
              Inquired Plan / Scope
            </label>
            <select
              id="contact-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0E131F] border border-white/15 text-white text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors"
            >
              <option value="Enterprise Custom Plan">
                Enterprise Custom Plan (Dedicated SLA & 50+ Sites)
              </option>
              <option value="Agency White-Label Plan">
                Agency White-Label Plan (Custom Branding & Status Pages)
              </option>
              <option value="High-Frequency Monitoring">
                High-Frequency Monitoring (Sub-Minute Probes)
              </option>
              <option value="Custom Infrastructure / Self-Hosted">
                Custom Infrastructure / Self-Hosted VPC
              </option>
              <option value="General Inquiry">General Sales / Partnership Inquiry</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="block text-xs font-mono uppercase tracking-wider text-neutral-300 mb-2 font-medium"
            >
              Project Requirements & Message <span className="text-[#00F0FF]">*</span>
            </label>
            <textarea
              id="contact-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about the number of websites, critical revenue funnels, required check frequencies, and integration requirements..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF] transition-colors resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_24px_rgba(0,240,255,0.45)] hover:bg-[#38F4FF] hover:shadow-[0_0_32px_rgba(0,240,255,0.65)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending Request..." : "Submit Enterprise Inquiry ↗"}
          </button>
        </form>
      )}
    </GlassCard>
  );
}

export default function ContactPage() {
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

      {/* Floating Frosted Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between px-6 py-3.5 rounded-full border border-white/10 bg-[#0E131F]/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Brand />
          <nav className="flex items-center gap-6" aria-label="Main navigation">
            <Link
              href="/"
              className="hidden md:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Platform
            </Link>
            <Link
              href="/pricing"
              className="hidden sm:inline-block text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
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

      <main className="max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-20">
        {/* Navigation Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-[#00F0FF] transition-colors"
          >
            ← Back to Pricing
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Context & Guarantees */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 backdrop-blur-md mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
                  TALK WITH SALES
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
                Let&apos;s build the right operations plan.
              </h1>
              <p className="text-base text-neutral-300 leading-relaxed">
                Whether you oversee a high-traffic e-commerce storefront, an agency managing 100+
                client properties, or require custom on-premise infrastructure, Guardian scales with
                your business.
              </p>
            </div>

            {/* Enterprise Guarantees Grid */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> Dedicated Uptime SLA
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Enterprise agreements include custom uptime SLAs up to 99.99% with guaranteed
                  incident escalation response times.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> White-Label & Custom Domains
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Publish client-facing status pages and scheduled PDF reports under your brand name
                  and domain with Row-Level Security isolation.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> Dedicated Solutions Architect
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Direct Slack/Teams channel support, guided onboarding, and custom webhook/API
                  integration engineering.
                </p>
              </div>
            </div>

            {/* Direct Contact Info */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-white/5 to-[#00F0FF]/5 border border-white/10">
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 block mb-2">
                DIRECT INQUIRIES
              </span>
              <p className="text-sm text-white font-medium">sales@useguardian.io</p>
              <p className="text-xs text-neutral-400 mt-1">
                Typical enterprise response time: &lt; 4 hours during business days.
              </p>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <Suspense
              fallback={
                <GlassCard className="p-12 text-center text-neutral-400 font-mono text-sm">
                  Loading inquiry form...
                </GlassCard>
              }
            >
              <ContactFormInner />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Frosted Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-12 py-8 px-6 backdrop-blur-xl bg-[#0A0D14]/75">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Brand />
          <p className="text-xs text-neutral-400 font-mono">
            Protect. Understand. Grow. · Enterprise Digital Business Operations
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-neutral-300">
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/audit" className="hover:text-white transition-colors">
              Free Audit
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
