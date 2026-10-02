"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { BILLING_PLANS } from "@/config/billing-plans";

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="marketing-page">
      <header className="public-header">
        <Brand />
        <nav aria-label="Main navigation">
          <Link href="/" className="desktop-link">
            Platform
          </Link>
          <Link href="/audit" className="desktop-link">
            Free audit
          </Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="button-primary compact">
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-12">
        <section className="text-center max-w-3xl mx-auto mb-12">
          <span className="status-pill mb-4 inline-block">
            <span></span> TRANSPARENT PRICING
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Protect your digital revenue at every scale.
          </h1>
          <p className="text-lg text-neutral-400 mb-8">
            Start with a 14-day card-free trial on all standard plans. No hidden fees. Cancel
            anytime.
          </p>

          {/* Billing Interval Toggle */}
          <div className="inline-flex items-center gap-3 bg-neutral-900/80 border border-neutral-800 p-1.5 rounded-full">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
                !annual
                  ? "bg-emerald-500 text-neutral-950 font-semibold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                annual
                  ? "bg-emerald-500 text-neutral-950 font-semibold shadow"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual billing</span>
              <span className="text-xs bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                2 months free
              </span>
            </button>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {BILLING_PLANS.map((plan) => {
            const isEnterprise = plan.id === "ENTERPRISE";
            const price = isEnterprise
              ? "Custom"
              : annual
                ? `$${plan.annualPriceCents / 100}`
                : `$${plan.monthlyPriceCents / 100}`;
            const intervalLabel = isEnterprise ? "" : annual ? "/year" : "/month";

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                  (plan as { isPopular?: boolean }).isPopular
                    ? "bg-neutral-900/90 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                {(plan as { isPopular?: boolean }).isPopular && (
                  <span className="absolute -top-3 left-6 text-xs font-bold uppercase tracking-widest bg-emerald-500 text-neutral-950 px-3 py-1 rounded-full shadow">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {plan.hasTrial && (
                      <span className="text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
                        14-day trial
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400 mb-6">{plan.tagline}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {price}
                    </span>
                    <span className="text-sm text-neutral-400">{intervalLabel}</span>
                  </div>

                  <div className="space-y-3 border-t border-neutral-800 pt-6 text-sm mb-8">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      <span>
                        <strong>
                          {plan.limits.maxWebsites === Infinity
                            ? "Unlimited"
                            : plan.limits.maxWebsites}
                        </strong>{" "}
                        {plan.limits.maxWebsites === 1 ? "website" : "websites"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      <span>
                        <strong>
                          {plan.limits.maxBusinesses === Infinity
                            ? "Unlimited"
                            : plan.limits.maxBusinesses}
                        </strong>{" "}
                        {plan.limits.maxBusinesses === 1 ? "business profile" : "client profiles"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      <span>
                        <strong>
                          {plan.limits.maxTeamMembers === Infinity
                            ? "Unlimited"
                            : plan.limits.maxTeamMembers}
                        </strong>{" "}
                        team {plan.limits.maxTeamMembers === 1 ? "seat" : "seats"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      <span>
                        Check cadence: <strong>every {plan.limits.minFrequencyMinutes}m</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <span className="text-emerald-400">✓</span>
                      <span>
                        <strong>{plan.limits.historyDays} days</strong> audit history
                      </span>
                    </div>
                    {plan.features.syntheticFormTests && (
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-emerald-400">✓</span>
                        <span>Synthetic lead form & booking checks</span>
                      </div>
                    )}
                    {plan.features.accessibilityMonitoring && (
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-emerald-400">✓</span>
                        <span>Accessibility hygiene checks</span>
                      </div>
                    )}
                    {plan.features.customBranding && (
                      <div className="flex items-center gap-2 text-neutral-300">
                        <span className="text-emerald-400">✓</span>
                        <span>Custom white-label branding</span>
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  href={
                    isEnterprise
                      ? "/audit"
                      : `/signup?plan=${plan.id}&interval=${annual ? "annual" : "monthly"}`
                  }
                  className={`w-full text-center py-3 rounded-lg text-sm font-semibold transition-all ${
                    (plan as { isPopular?: boolean }).isPopular
                      ? "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold"
                      : "bg-neutral-800 hover:bg-neutral-700 text-white"
                  }`}
                >
                  {isEnterprise
                    ? "Contact Sales"
                    : plan.hasTrial
                      ? "Start 14-day free trial"
                      : "Get started"}
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto border-t border-neutral-800 pt-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
              <h3 className="font-semibold text-white mb-2">
                Do I need a credit card to start a trial?
              </h3>
              <p className="text-sm text-neutral-400">
                No. All paid plans include a 14-day free trial without requiring credit card details
                upfront. You can experience Guardian&apos;s full monitoring and issue resolution
                capabilities before deciding.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
              <h3 className="font-semibold text-white mb-2">
                Can I switch plans or cancel anytime?
              </h3>
              <p className="text-sm text-neutral-400">
                Yes. You can upgrade, downgrade, or cancel your subscription at any time directly
                from your billing dashboard. Changes take effect seamlessly with pro-rated billing.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-5">
              <h3 className="font-semibold text-white mb-2">
                What happens when an issue is detected?
              </h3>
              <p className="text-sm text-neutral-400">
                Guardian immediately alerts you via your configured channels (email, in-app
                notifications, webhooks) and provides grounded, plain-English business impact
                analysis alongside step-by-step developer remediation steps.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
