"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { BILLING_PLANS } from "@/config/billing-plans";
import { AmbientBackground } from "@/components/ui/ambient-background";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusCapsule } from "@/components/ui/status-capsule";

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="relative min-h-screen bg-canvas text-foreground selection:bg-primary/20 selection:text-primary">
      <AmbientBackground variant="audit" />

      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-glass-specular-border bg-canvas/60">
        <Brand />
        <nav aria-label="Main navigation" className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Platform
          </Link>
          <Link
            href="/audit"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Free audit
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Contact Sales
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary text-neutral-950 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="main-content" className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <section className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex justify-center mb-6">
            <StatusCapsule status="operational" label="TRANSPARENT PRICING" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Protect your digital revenue at every scale.
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 mb-10 leading-relaxed">
            Start with a 14-day card-free trial on all standard plans. No hidden fees. Cancel
            anytime.
          </p>

          {/* Billing Interval Dynamic Capsule Toggle */}
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full bg-surface-lowest/90 backdrop-blur-xl border border-glass-specular-border shadow-xl">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-300 active:scale-95 ${
                !annual
                  ? "bg-primary text-neutral-950 font-semibold shadow-md shadow-primary/25"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-300 flex items-center gap-2 active:scale-95 ${
                annual
                  ? "bg-primary text-neutral-950 font-semibold shadow-md shadow-primary/25"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual billing</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                  annual
                    ? "bg-neutral-950/20 text-neutral-950"
                    : "bg-primary/10 border border-primary/30 text-primary"
                }`}
              >
                2 months free
              </span>
            </button>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {BILLING_PLANS.map((plan) => {
            const isEnterprise = plan.id === "ENTERPRISE";
            const price = isEnterprise
              ? "Custom"
              : annual
                ? `$${plan.annualPriceCents / 100}`
                : `$${plan.monthlyPriceCents / 100}`;
            const intervalLabel = isEnterprise ? "" : annual ? "/year" : "/month";
            const isPopular = Boolean((plan as { isPopular?: boolean }).isPopular);

            return (
              <GlassCard
                key={plan.id}
                variant={isPopular ? "elevated" : "default"}
                glow={isPopular ? "cyan" : "none"}
                className={`relative flex flex-col justify-between p-8 transition-all duration-300 ${
                  isPopular
                    ? "ring-2 ring-primary/40 shadow-2xl shadow-primary/10 -translate-y-1.5"
                    : "hover:-translate-y-1"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3.5 left-8 text-[11px] font-bold uppercase tracking-widest bg-gradient-to-r from-primary to-accent-violet text-neutral-950 px-4 py-1 rounded-full shadow-lg shadow-primary/30">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex justify-between items-baseline mb-3">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{plan.name}</h2>
                    {plan.hasTrial && (
                      <span className="text-xs text-primary font-medium bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full">
                        14-day trial
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400 mb-8 leading-relaxed">{plan.tagline}</p>

                  <div className="flex items-baseline gap-1.5 mb-8">
                    <span className="text-5xl font-black text-white tracking-tight">{price}</span>
                    <span className="text-sm text-neutral-400 font-medium">{intervalLabel}</span>
                  </div>

                  <div className="space-y-3.5 border-t border-glass-specular-border pt-6 text-sm mb-10">
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-primary font-bold">✓</span>
                      <span>
                        <strong className="text-white">
                          {plan.limits.maxWebsites === Infinity
                            ? "Unlimited"
                            : plan.limits.maxWebsites}
                        </strong>{" "}
                        {plan.limits.maxWebsites === 1 ? "website" : "websites"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-primary font-bold">✓</span>
                      <span>
                        <strong className="text-white">
                          {plan.limits.maxBusinesses === Infinity
                            ? "Unlimited"
                            : plan.limits.maxBusinesses}
                        </strong>{" "}
                        {plan.limits.maxBusinesses === 1 ? "business profile" : "client profiles"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-primary font-bold">✓</span>
                      <span>
                        <strong className="text-white">
                          {plan.limits.maxTeamMembers === Infinity
                            ? "Unlimited"
                            : plan.limits.maxTeamMembers}
                        </strong>{" "}
                        team {plan.limits.maxTeamMembers === 1 ? "seat" : "seats"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-primary font-bold">✓</span>
                      <span>
                        Check cadence:{" "}
                        <strong className="text-white">
                          every {plan.limits.minFrequencyMinutes}m
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-300">
                      <span className="text-primary font-bold">✓</span>
                      <span>
                        <strong className="text-white">{plan.limits.historyDays} days</strong> audit
                        history
                      </span>
                    </div>
                    {plan.features.syntheticFormTests && (
                      <div className="flex items-center gap-3 text-neutral-300">
                        <span className="text-primary font-bold">✓</span>
                        <span>Synthetic lead form & booking checks</span>
                      </div>
                    )}
                    {plan.features.accessibilityMonitoring && (
                      <div className="flex items-center gap-3 text-neutral-300">
                        <span className="text-primary font-bold">✓</span>
                        <span>Accessibility hygiene checks</span>
                      </div>
                    )}
                    {plan.features.agencyBranding && (
                      <div className="flex items-center gap-3 text-neutral-300">
                        <span className="text-primary font-bold">✓</span>
                        <span>Custom white-label branding</span>
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  href={
                    isEnterprise
                      ? "/contact?plan=ENTERPRISE"
                      : plan.id === "FREE"
                        ? "/audit"
                        : `/signup?plan=${plan.id}&interval=${annual ? "annual" : "monthly"}`
                  }
                  className={`w-full text-center py-3.5 rounded-2xl text-sm font-semibold tracking-wide transition-all active:scale-95 shadow-md ${
                    isPopular
                      ? "bg-primary hover:brightness-110 text-neutral-950 font-bold shadow-primary/20"
                      : "bg-surface-elevated hover:bg-neutral-800 text-white border border-glass-specular-border"
                  }`}
                >
                  {isEnterprise
                    ? "Contact Sales"
                    : plan.id === "FREE"
                      ? "Run free audit"
                      : plan.hasTrial
                        ? "Start 14-day free trial"
                        : "Get started"}
                </Link>
              </GlassCard>
            );
          })}
        </div>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto border-t border-glass-specular-border pt-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10 tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white text-base mb-2">
                Do I need a credit card to start a trial?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                No. All paid plans include a 14-day free trial without requiring credit card details
                upfront. You can experience Guardian&apos;s full monitoring and issue resolution
                capabilities before deciding.
              </p>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white text-base mb-2">
                Can I switch plans or cancel anytime?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Yes. You can upgrade, downgrade, or cancel your subscription at any time directly
                from your billing dashboard. Changes take effect seamlessly with pro-rated billing.
              </p>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white text-base mb-2">
                What happens when an issue is detected?
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Guardian immediately alerts you via your configured channels (email, in-app
                notifications, webhooks) and provides grounded, plain-English business impact
                analysis alongside step-by-step developer remediation steps.
              </p>
            </GlassCard>
          </div>
        </section>
      </main>
    </div>
  );
}
