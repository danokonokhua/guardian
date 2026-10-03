"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BILLING_PLANS, billingPlanLabel, getPlanDefinition } from "@/config/billing-plans";

interface BillingSummary {
  organizationId: string;
  organizationName: string;
  plan: string;
  subscription: {
    status: string;
    interval: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  limits: {
    maxWebsites: number;
    maxBusinesses: number;
    maxTeamMembers: number;
    minFrequencyMinutes: number;
    historyDays: number;
  };
  usage: {
    websitesCount: number;
    businessesCount: number;
    membersCount: number;
  };
  trial: {
    isTrialing: boolean;
    trialEndsAt: string | null;
    daysRemaining: number | null;
  };
  invoices: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    invoiceNumber: string | null;
    hostedInvoiceUrl: string | null;
    pdfUrl: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
  livePaymentConnected?: boolean;
}

export function BillingOverview({
  organizationId,
  organizationName,
  plan,
}: {
  organizationId?: string;
  organizationName: string;
  plan: string | null;
}) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(organizationId));
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    let isMounted = true;
    fetch(`/api/v1/organizations/${organizationId}/billing`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.data) {
          setSummary(json.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  const currentPlanId = summary?.plan ?? plan;
  const currentPlan = currentPlanId ? getPlanDefinition(currentPlanId) : null;

  // Unconnected / static view when organizationId is absent (for preview/tests)
  if (!organizationId) {
    return (
      <>
        <section className="billing-current">
          <div>
            <span className="eyebrow">ORGANIZATION PLAN</span>
            <h2>{plan ? billingPlanLabel(plan) : "Plan unavailable"}</h2>
            <p>{organizationName}</p>
            <span className="status-pill">{plan ? "RECORDED PLAN" : "UNAVAILABLE"}</span>
          </div>
          <div className="billing-status">
            <span className="eyebrow">SUBSCRIPTION STATUS</span>
            <h3>Billing setup pending</h3>
            <p>
              Your recorded plan is shown here. Paid subscriptions and payment details are not
              connected yet.
            </p>
            <Link href="/dashboard" className="button-secondary compact">
              Return to operations
            </Link>
          </div>
        </section>
        <section>
          <div className="billing-section-heading">
            <span className="eyebrow">PLAN CATALOG</span>
            <h2>A plan for every stage.</h2>
            <p>Pricing, included features, and usage allowances will appear once configured.</p>
          </div>
          <div className="billing-plan-grid">
            {BILLING_PLANS.slice(0, 6).map((p) => (
              <article
                className={`setup-card billing-plan ${p.id === plan ? "billing-selected" : ""}`}
                key={p.id}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3>{p.name}</h3>
                  {plan && p.id === plan && <span className="status-pill">CURRENT PLAN</span>}
                </div>
                <p className="billing-price">Pricing not configured</p>
                <dl>
                  <div>
                    <dt>Included features</dt>
                    <dd>To be configured</dd>
                  </div>
                  <div>
                    <dt>Usage allowances</dt>
                    <dd>To be configured</dd>
                  </div>
                  <div>
                    <dt>Subscription options</dt>
                    <dd>Not available yet</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
        <div className="billing-details-grid">
          {[
            {
              title: "Usage & allowances",
              text: "Plan-based usage metering is not connected. Monitoring activity is available in your operations dashboard.",
            },
            {
              title: "Payment method",
              text: "No payment-provider information is available. Payment methods cannot be added here yet.",
            },
            {
              title: "Invoices & receipts",
              text: "Invoice history is unavailable until billing is connected. This does not indicate whether charges exist elsewhere.",
            },
          ].map((item) => (
            <section className="setup-card" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </section>
          ))}
        </div>
      </>
    );
  }

  const handleCheckout = async (targetPlanId: string) => {
    setProcessingPlan(targetPlanId);
    setMessage(null);

    try {
      // In sandbox mode (live Stripe not connected), switch plan directly in-app
      if (summary?.livePaymentConnected === false) {
        const changeRes = await fetch(`/api/v1/organizations/${organizationId}/billing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "change_plan",
            plan: targetPlanId,
          }),
        });
        const changeJson = await changeRes.json();
        if (changeJson.data) {
          setMessage(
            `Live payment gateway is not connected. Switched to ${getPlanDefinition(targetPlanId).name} plan in Sandbox Mode (no credit card charged).`,
          );
          const refreshed = await fetch(`/api/v1/organizations/${organizationId}/billing`).then((r) => r.json());
          if (refreshed.data) setSummary(refreshed.data);
        } else {
          setMessage(changeJson.error?.message ?? "Unable to update plan.");
        }
        return;
      }

      // Live payment mode: call checkout API
      const res = await fetch(`/api/v1/organizations/${organizationId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: targetPlanId,
          interval: "MONTHLY",
        }),
      });

      const json = await res.json();
      if (
        json.data?.url &&
        json.data?.livePaymentConnected !== false &&
        !json.data.url.includes("mock_checkout=true") &&
        !json.data.url.includes("localhost")
      ) {
        window.location.href = json.data.url;
      } else {
        const changeRes = await fetch(`/api/v1/organizations/${organizationId}/billing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "change_plan",
            plan: targetPlanId,
          }),
        });
        const changeJson = await changeRes.json();
        if (changeJson.data) {
          setMessage(
            `Live payment gateway is not connected. Switched to ${getPlanDefinition(targetPlanId).name} plan in Sandbox Mode (no credit card charged).`,
          );
          const refreshed = await fetch(`/api/v1/organizations/${organizationId}/billing`).then((r) => r.json());
          if (refreshed.data) setSummary(refreshed.data);
        }
      }
    } catch {
      setMessage("Unable to update plan. Please try again.");
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleStartTrial = async () => {
    setProcessingPlan("PRO");
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_trial", plan: "PRO" }),
      });
      const json = await res.json();
      if (json.data) {
        setMessage("Your 14-day Pro trial has started!");
        const refreshed = await fetch(`/api/v1/organizations/${organizationId}/billing`).then((r) => r.json());
        if (refreshed.data) setSummary(refreshed.data);
      }
    } catch {
      setMessage("Unable to start trial. Please try again.");
    } finally {
      setProcessingPlan(null);
    }
  };

  const handlePortal = async () => {
    if (summary?.livePaymentConnected === false) {
      setMessage("Stripe Customer Portal is unavailable because live payments are not connected yet.");
      return;
    }

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (
        json.data?.url &&
        json.data?.livePaymentConnected !== false &&
        !json.data.url.includes("mock_portal=true") &&
        !json.data.url.includes("localhost")
      ) {
        window.location.href = json.data.url;
      } else {
        setMessage("Stripe Customer Portal is unavailable because live payments are not connected yet.");
      }
    } catch {
      setMessage("Unable to open billing portal.");
    }
  };

  const handleSimulateWebhook = async (
    eventType: string,
    targetPlan?: string,
    amountCents?: number,
  ) => {
    if (!organizationId) return;
    setSimulating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/billing/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          plan: targetPlan,
          amountCents,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(
          `Simulated Stripe webhook (${eventType}) processed successfully!`,
        );
        const refreshed = await fetch(`/api/v1/organizations/${organizationId}/billing`).then((r) =>
          r.json(),
        );
        if (refreshed.data) setSummary(refreshed.data);
      } else {
        setMessage(json.error?.message ?? "Failed to simulate webhook event.");
      }
    } catch {
      setMessage("Failed to trigger webhook simulation.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      {message && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm">
          {message}
        </div>
      )}

      {loading && (
        <div className="mb-6 text-xs text-neutral-400 animate-pulse">
          Refreshing plan and resource allocations…
        </div>
      )}

      {/* Live Payment Status Notice */}
      {summary && summary.livePaymentConnected === false && (
        <aside className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 flex items-start gap-3">
          <span className="text-amber-400 text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <strong className="text-amber-300 text-sm font-semibold block">
              Live Stripe Payment Gateway Not Connected (Sandbox Demo Mode)
            </strong>
            <p className="text-xs text-neutral-300 mt-1">
              Live Stripe payment credentials are not configured on this server. Selecting a plan switches your organization tier directly in Sandbox Mode without charging a real credit card, and will not redirect to external checkout.
            </p>
          </div>
        </aside>
      )}

      {/* Trial Countdown Banner */}
      {summary?.trial?.isTrialing && (
        <aside className="mb-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/60 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">14-Day Free Trial</span>
            <p className="text-sm text-neutral-200 mt-1">
              You are enjoying the <strong>{currentPlan?.name ?? "Pro"}</strong> plan for free.{" "}
              {summary.trial.daysRemaining !== null ? (
                <span>
                  <strong>{summary.trial.daysRemaining} days remaining</strong>.
                </span>
              ) : null}
            </p>
          </div>
          <button onClick={() => handleCheckout("PRO")} className="button-primary compact">
            Upgrade subscription
          </button>
        </aside>
      )}

      {/* Current Plan & Subscription Status Section */}
      <section className="billing-current">
        <div>
          <span className="eyebrow">ORGANIZATION PLAN</span>
          <h2>{currentPlan?.name ?? (plan ? billingPlanLabel(plan) : "Plan unavailable")}</h2>
          <p>{organizationName}</p>
          <span className="status-pill">
            {summary?.subscription?.status ? summary.subscription.status : currentPlanId && currentPlanId !== "FREE" ? "ACTIVE" : "FREE TIER"}
          </span>
        </div>
        <div className="billing-status">
          <span className="eyebrow">BILLING CONTROLS</span>
          <h3>{currentPlan?.tagline ?? "Plan options"}</h3>
          <p>
            {currentPlanId === "FREE"
              ? "Upgrade to a paid plan to unlock continuous automated checks and synthetic monitoring."
              : `Your organization is billed ${summary?.subscription?.interval?.toLowerCase() ?? "monthly"}.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {currentPlanId === "FREE" && !summary?.trial?.isTrialing ? (
              <button
                onClick={handleStartTrial}
                disabled={processingPlan !== null}
                className="button-primary compact"
              >
                {processingPlan ? "Starting trial…" : "Start 14-day Pro Trial"}
              </button>
            ) : (
              <button onClick={handlePortal} className="button-secondary compact">
                Manage payment & invoices
              </button>
            )}
            <Link href="/dashboard" className="button-secondary compact">
              Return to operations
            </Link>
          </div>
        </div>
      </section>

      {/* Usage & Allowances Progress Meters */}
      <section className="mt-8 mb-10">
        <div className="billing-section-heading">
          <span className="eyebrow">RESOURCE ALLOCATION</span>
          <h2>Usage against plan quotas</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="setup-card">
            <span className="text-xs uppercase tracking-wider text-neutral-400">Websites Monitored</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {summary?.usage?.websitesCount ?? 0}
              </span>
              <span className="text-sm text-neutral-400">
                / {currentPlan?.limits.maxWebsites === Infinity ? "Unlimited" : currentPlan?.limits.maxWebsites ?? 1}
              </span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((summary?.usage?.websitesCount ?? 0) /
                      (currentPlan?.limits.maxWebsites === Infinity ? 100 : currentPlan?.limits.maxWebsites ?? 1)) *
                      100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="setup-card">
            <span className="text-xs uppercase tracking-wider text-neutral-400">Client Profiles</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {summary?.usage?.businessesCount ?? 0}
              </span>
              <span className="text-sm text-neutral-400">
                / {currentPlan?.limits.maxBusinesses === Infinity ? "Unlimited" : currentPlan?.limits.maxBusinesses ?? 1}
              </span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((summary?.usage?.businessesCount ?? 0) /
                      (currentPlan?.limits.maxBusinesses === Infinity ? 100 : currentPlan?.limits.maxBusinesses ?? 1)) *
                      100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="setup-card">
            <span className="text-xs uppercase tracking-wider text-neutral-400">Team Seats</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {summary?.usage?.membersCount ?? 0}
              </span>
              <span className="text-sm text-neutral-400">
                / {currentPlan?.limits.maxTeamMembers === Infinity ? "Unlimited" : currentPlan?.limits.maxTeamMembers ?? 1}
              </span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((summary?.usage?.membersCount ?? 0) /
                      (currentPlan?.limits.maxTeamMembers === Infinity ? 100 : currentPlan?.limits.maxTeamMembers ?? 1)) *
                      100
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Catalog Grid */}
      <section className="mt-8">
        <div className="billing-section-heading">
          <span className="eyebrow">PLAN CATALOG</span>
          <h2>A plan for every stage of your business.</h2>
          <p>Instant activation. All standard paid plans include a 14-day free trial.</p>
        </div>
        <div className="billing-plan-grid">
          {BILLING_PLANS.map((p) => {
            const isSelected = p.id === currentPlanId;
            const isProcessing = processingPlan === p.id;
            const isEnterprise = p.id === "ENTERPRISE";
            const price = isEnterprise ? "Custom" : `$${p.monthlyPriceCents / 100}`;

            return (
              <article
                className={`setup-card billing-plan ${isSelected ? "billing-selected ring-1 ring-emerald-500/50" : ""}`}
                key={p.id}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3>{p.name}</h3>
                  {isSelected && <span className="status-pill">CURRENT PLAN</span>}
                </div>
                <p className="billing-price">{price} {isEnterprise ? "" : "/mo"}</p>
                <dl>
                  <div>
                    <dt>Websites</dt>
                    <dd>{p.limits.maxWebsites === Infinity ? "Unlimited" : p.limits.maxWebsites}</dd>
                  </div>
                  <div>
                    <dt>Clients</dt>
                    <dd>{p.limits.maxBusinesses === Infinity ? "Unlimited" : p.limits.maxBusinesses}</dd>
                  </div>
                  <div>
                    <dt>Team seats</dt>
                    <dd>{p.limits.maxTeamMembers === Infinity ? "Unlimited" : p.limits.maxTeamMembers}</dd>
                  </div>
                  <div>
                    <dt>Check frequency</dt>
                    <dd>Every {p.limits.minFrequencyMinutes} min</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  {isSelected ? (
                    <button disabled className="w-full button-secondary compact opacity-60 cursor-default">
                      Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(p.id)}
                      disabled={isProcessing}
                      className="w-full button-primary compact"
                    >
                      {isProcessing ? "Connecting…" : isEnterprise ? "Contact Sales" : "Select Plan"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Stripe Sandbox & Demo Simulation Controls */}
      <section className="mt-10 p-5 rounded-xl border border-amber-600/30 bg-amber-950/20 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Stripe Sandbox & Demo Mode
            </span>
          </div>
          <span className="text-xs text-neutral-400">
            Simulate Stripe webhook events without live payment credentials
          </span>
        </div>
        <p className="text-sm text-neutral-300 mb-4">
          Demonstrate end-to-end plan upgrades, subscription renewals, and invoice receipt generation in real-time:
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => handleSimulateWebhook("customer.subscription.updated", "GROWTH", 2900)}
            disabled={simulating}
            className="button-secondary compact text-xs"
          >
            {simulating ? "Processing…" : "Simulate Growth Upgrade ($29)"}
          </button>
          <button
            onClick={() => handleSimulateWebhook("customer.subscription.updated", "PRO", 5900)}
            disabled={simulating}
            className="button-secondary compact text-xs"
          >
            {simulating ? "Processing…" : "Simulate Pro Upgrade ($59)"}
          </button>
          <button
            onClick={() => handleSimulateWebhook("invoice.payment_succeeded", undefined, 5900)}
            disabled={simulating}
            className="button-secondary compact text-xs"
          >
            {simulating ? "Processing…" : "Simulate Invoice Payment ($59.00)"}
          </button>
          <button
            onClick={() => handleSimulateWebhook("customer.subscription.deleted")}
            disabled={simulating}
            className="button-secondary compact text-xs text-rose-300 hover:text-rose-200"
          >
            {simulating ? "Processing…" : "Simulate Cancelation"}
          </button>
        </div>
      </section>

      {/* Invoices History Table */}
      <section className="mt-12">
        <div className="billing-section-heading">
          <span className="eyebrow">BILLING HISTORY</span>
          <h2>Invoices & receipts</h2>
        </div>
        <div className="setup-card overflow-x-auto">
          {summary?.invoices && summary.invoices.length > 0 ? (
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {summary.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 px-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono text-xs">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                    <td className="py-3 px-4">${(inv.amountCents / 100).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="status-pill text-xs">{inv.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.pdfUrl ? (
                        <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                          Download PDF
                        </a>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-sm text-neutral-400">
              No invoice charges recorded for this organization yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
