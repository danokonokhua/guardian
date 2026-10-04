"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  isPopular?: boolean;
  limits: {
    websites: string;
    cadence: string;
    history: string;
    teamSeats: string;
  };
  highlights: string[];
}

const FEATURED_PLANS: PricingPlan[] = [
  {
    id: "STARTER",
    name: "Starter",
    tagline: "Essential protection for single business websites.",
    monthlyPrice: 9,
    annualPrice: 90,
    limits: {
      websites: "1 Website",
      cadence: "Every 5 min",
      history: "30-day history",
      teamSeats: "2 Team seats",
    },
    highlights: [
      "Continuous uptime & latency probing",
      "SSL certificate runway countdown",
      "Critical lead-form detection",
      "Basic SEO & security header hygiene",
      "Real-time email & in-app alerts",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    tagline: "Full digital health & predictive intelligence for growing brands.",
    monthlyPrice: 29,
    annualPrice: 290,
    limits: {
      websites: "5 Websites",
      cadence: "Every 5 min",
      history: "90-day history",
      teamSeats: "5 Team seats",
    },
    highlights: [
      "Everything in Starter",
      "Core Web Vitals & PageSpeed scans",
      "Predictive failure forecasting & runway",
      "AutoFix autonomous remediation (manual approval)",
      "Daily & weekly executive digest reports",
      "WordPress & marketplace integrations",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    tagline: "Maximum protection with Autonomous AI COO directives.",
    monthlyPrice: 59,
    annualPrice: 590,
    isPopular: true,
    limits: {
      websites: "10 Websites",
      cadence: "Every 1 min",
      history: "365-day history",
      teamSeats: "10 Team seats",
    },
    highlights: [
      "Everything in Growth",
      "AI COO executive directives ($USD impact)",
      "Synthetic form & checkout journey probing",
      "Full autonomous AutoFix engine with rollbacks",
      "Google Search Console & GBP sentiment tracking",
      "PWA mobile command & Web Push alerts",
      "Developer API access & webhook triggers",
    ],
  },
];

const FAQS = [
  {
    question: "Do I need a credit card to start a free trial?",
    answer:
      "No. All paid plans include a 14-day free trial without requiring credit card details upfront. You can experience Guardian's full monitoring, predictive intelligence, and remediation capabilities risk-free.",
  },
  {
    question: "How is Guardian different from traditional uptime monitors?",
    answer:
      "Traditional tools like Pingdom or UptimeRobot only ping servers to check HTTP status codes. Guardian monitors your entire digital business: lead capture forms, checkout funnels, SSL runway, DNS drift, SEO indexation, security headers, Core Web Vitals, and customer reviews. Guardian calculates the financial impact of issues in $USD and predicts failures before downtime happens.",
  },
  {
    question: "Can Guardian fix detected issues automatically?",
    answer:
      "Yes! Through our AutoFix engine, Guardian can automatically resolve common failure modes—such as DNS failovers, SSL renewal triggers, Cloudflare cache purges, robots.txt restoration, and WordPress plugin security patches. Every automated action comes with 1-click rollback protection.",
  },
  {
    question: "What is the AI COO?",
    answer:
      "The AI COO (Chief Operating Officer) is an autonomous executive operations engine that digests multi-vector telemetry across your websites, revenue funnels, performance, security, and marketplace channels. It synthesizes complex technical signals into prioritized executive directives (P0 Immediate to P3 Strategic), quantifies the dollar impact ($USD) of fixing them, and offers 1-click execution.",
  },
  {
    question: "Can agencies and MSPs white-label Guardian for clients?",
    answer:
      "Yes. Our Agency and Enterprise tiers include full white-label capabilities: custom branding, client workspaces with Row-Level Security, branded PDF/email reports, and custom domain-mapped status pages (e.g. status.youragency.com).",
  },
  {
    question: "Can I upgrade, downgrade, or cancel at any time?",
    answer:
      "Absolutely. You can change your plan or cancel anytime directly from your billing settings. Subscriptions can be billed monthly or annually (with 2 months free on annual plans), and changes take effect immediately with prorated billing.",
  },
];

export function PricingAndFaqSection() {
  const [annual, setAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <>
      {/* Pricing Section */}
      <section className="scroll-mt-24 pt-8" id="pricing">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 backdrop-blur-md mb-6">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              TRANSPARENT, VALUE-DRIVEN PLANS
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Protect your revenue at every scale.
          </h2>
          <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto mb-8">
            Start with a 14-day card-free trial on all plans. No contracts. Cancel or switch
            anytime.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center p-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                !annual
                  ? "bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                annual
                  ? "bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                  annual
                    ? "bg-[#0A0D14]/20 text-[#0A0D14]"
                    : "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30"
                }`}
              >
                2 Months Free
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {FEATURED_PLANS.map((plan) => {
            const price = annual ? `$${plan.annualPrice}` : `$${plan.monthlyPrice}`;
            const intervalLabel = annual ? "/year" : "/month";

            return (
              <GlassCard
                key={plan.id}
                variant={plan.isPopular ? "elevated" : "default"}
                glow={plan.isPopular ? "cyan" : "none"}
                className={`relative flex flex-col justify-between p-8 transition-all duration-300 ${
                  plan.isPopular
                    ? "ring-2 ring-[#00F0FF]/60 shadow-[0_0_40px_rgba(0,240,255,0.2)] md:-translate-y-2"
                    : "hover:-translate-y-1"
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3.5 left-8 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#6807ba] text-[#0A0D14] px-4 py-1 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.5)]">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-2xl font-bold text-white tracking-tight">{plan.name}</h3>
                    <span className="text-[11px] font-mono text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/25 px-2.5 py-0.5 rounded-full">
                      14-day trial
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 mb-6 leading-relaxed min-h-[40px]">
                    {plan.tagline}
                  </p>

                  <div className="flex items-baseline gap-1.5 mb-6 pb-6 border-b border-white/10">
                    <span className="text-5xl font-extrabold text-white tracking-tight">
                      {price}
                    </span>
                    <span className="text-sm font-medium text-neutral-400">{intervalLabel}</span>
                  </div>

                  {/* Core Capacity Limits */}
                  <div className="grid grid-cols-2 gap-2 mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
                    <div className="text-neutral-200">
                      <span className="text-[#00F0FF] mr-1">✦</span>
                      {plan.limits.websites}
                    </div>
                    <div className="text-neutral-200">
                      <span className="text-[#00F0FF] mr-1">✦</span>
                      {plan.limits.cadence}
                    </div>
                    <div className="text-neutral-200">
                      <span className="text-[#00F0FF] mr-1">✦</span>
                      {plan.limits.history}
                    </div>
                    <div className="text-neutral-200">
                      <span className="text-[#00F0FF] mr-1">✦</span>
                      {plan.limits.teamSeats}
                    </div>
                  </div>

                  {/* Feature Highlights */}
                  <div className="space-y-3 text-sm mb-8">
                    {plan.highlights.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5 text-neutral-300">
                        <span className="text-[#00F0FF] font-bold text-base leading-none">✓</span>
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/signup?plan=${plan.id}&interval=${annual ? "annual" : "monthly"}`}
                  className={`w-full text-center py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md ${
                    plan.isPopular
                      ? "bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_24px_rgba(0,240,255,0.4)] hover:bg-[#38F4FF] hover:shadow-[0_0_32px_rgba(0,240,255,0.6)]"
                      : "bg-white/10 hover:bg-white/15 text-white border border-white/20"
                  }`}
                >
                  Start 14-day free trial <span aria-hidden="true">↗</span>
                </Link>
              </GlassCard>
            );
          })}
        </div>

        {/* Agency & Enterprise Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-white/5 via-[#00F0FF]/5 to-[#6807ba]/10 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl mb-24">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#00F0FF] mb-2">
              AGENCY & ENTERPRISE
            </div>
            <h4 className="text-xl sm:text-2xl font-bold text-white mb-1">
              Need multi-client white-labeling or high-volume monitoring?
            </h4>
            <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Agency plans start at $199/mo with unlimited client status pages on custom domains,
              branded PDF/email digests, and 50+ websites. Enterprise solutions offer dedicated SLAs
              and custom integrations.
            </p>
          </div>
          <Link
            href="/pricing"
            className="whitespace-nowrap px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-95"
          >
            Explore all tiers & features ↗
          </Link>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="scroll-mt-24 max-w-4xl mx-auto" id="faq">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
              COMMON QUESTIONS
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-neutral-300">
            Everything you need to know about Guardian, monitoring, AutoFix, and billing.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <GlassCard
                key={faq.question}
                className="overflow-hidden transition-all duration-200 border-white/10 hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-semibold text-white tracking-tight">
                    {faq.question}
                  </span>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-sm font-mono text-[#00F0FF] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-0 text-sm sm:text-base text-neutral-300 leading-relaxed border-t border-white/5 pt-4">
                    {faq.answer}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>

        <div className="text-center mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 text-sm text-neutral-400">
          Have more questions or custom enterprise requirements?{" "}
          <Link href="/audit" className="text-[#00F0FF] font-semibold hover:underline">
            Run a free website audit
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="text-[#00F0FF] font-semibold hover:underline">
            create your workspace
          </Link>{" "}
          to test Guardian live.
        </div>
      </section>
    </>
  );
}
