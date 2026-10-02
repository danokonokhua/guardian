import Link from "next/link";
import { BILLING_PLANS, billingPlanLabel } from "@/config/billing-plans";
export function BillingOverview({
  organizationName,
  plan,
}: {
  organizationName: string;
  plan: string | null;
}) {
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
          {BILLING_PLANS.map((p) => (
            <article
              className={`setup-card billing-plan ${p.id === plan ? "billing-selected" : ""}`}
              key={p.id}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3>{p.name}</h3>
                {p.id === plan && <span className="status-pill">CURRENT PLAN</span>}
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
      <aside className="view-limit">
        <span className="eyebrow">BILLING AVAILABILITY</span>
        <p>
          Trials, plan changes, cancellation, invoices, and payment processing will become available
          when subscriptions are connected. This screen does not create charges or change your
          organization&apos;s plan.
        </p>
      </aside>
    </>
  );
}
