# Guardian working pricing specification

Accepted working specification: 28 September 2026. This records product pricing and intended entitlements; billing implementation remains paused. Inclusion in this table does not establish that a module is implemented or available for sale.

Prices below retain the supplied dollar denomination. Currency code, taxes and payment-provider configuration must be confirmed before checkout is enabled.

| Feature / Limit                | Free Audit | Starter      | Growth           | Pro         | Agency      | White Label   | Enterprise |
| ------------------------------ | ---------- | ------------ | ---------------- | ----------- | ----------- | ------------- | ---------- |
| Monthly price                  | $0         | $9           | $29              | $59         | $99         | $249          | Custom     |
| Annual price                   | —          | $90          | $290             | $590        | $990        | $2,490        | Custom     |
| Websites                       | 1 audit    | 1            | 5                | 10          | 25          | 100           | Custom     |
| Businesses / clients           | 1          | 1            | 3                | 10          | 25          | 100           | Custom     |
| Team users                     | 1          | 2            | 5                | 10          | 15          | 50            | Custom     |
| 14-day free trial              | —          | Yes          | Yes              | Yes         | Yes         | Yes           | Negotiated |
| Credit card required for trial | —          | No           | No               | No          | No          | No            | —          |
| Continuous monitoring          | No         | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Uptime / HTTP monitoring       | One-time   | Every 5 min  | Every 5 min      | Every 5 min | Every 5 min | Every 5 min   | 1–5 min    |
| SSL monitoring                 | Snapshot   | Daily        | Daily            | Daily       | Daily       | Daily         | Custom     |
| Security-header monitoring     | Snapshot   | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| DNS monitoring                 | Snapshot   | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Domain-expiry monitoring       | Snapshot   | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| SPF / DMARC checks             | Snapshot   | No           | Yes              | Yes         | Yes         | Yes           | Yes        |
| Basic SEO audit                | Yes        | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Advanced SEO intelligence      | No         | No           | Yes              | Yes         | Yes         | Yes           | Yes        |
| Broken-link scanning           | Sample     | Limited      | Weekly           | Weekly      | Weekly      | Weekly        | Custom     |
| Performance monitoring         | Snapshot   | Daily        | Every 12 hrs     | Every 6 hrs | Every 6 hrs | Every 6 hrs   | Custom     |
| Accessibility monitoring       | Snapshot   | No           | Basic            | Yes         | Yes         | Yes           | Yes        |
| Critical pages monitored       | —          | 3            | 10               | 25          | Per client  | Per client    | Custom     |
| Lead/form monitoring           | Snapshot   | 1            | 5                | 20          | Per client  | Per client    | Custom     |
| Synthetic form tests*          | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Booking / checkout monitoring* | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Digital Health Score           | Snapshot   | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Issue detection & severity     | Basic      | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Business-impact explanation    | Basic      | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Fix recommendations            | Basic      | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| In-app alerts                  | No         | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Email alerts                   | No         | Yes          | Yes              | Yes         | Yes         | Yes           | Yes        |
| Daily/weekly digests           | No         | Monthly only | Yes              | Yes         | Yes         | Yes           | Custom     |
| Monitoring history             | Snapshot   | 30 days      | 90 days          | 12 months   | 12 months   | 24 months     | Custom     |
| Reports                        | Audit      | Monthly      | Weekly + monthly | Executive   | Per-client  | Fully branded | Custom     |
| AI Insights / month*           | 0          | 10           | 50               | 200         | 500 shared  | 2,000 shared  | Custom     |
| AI issue explanations*         | No         | Limited      | Yes              | Yes         | Yes         | Yes           | Yes        |
| AI prioritization*             | No         | No           | Limited          | Yes         | Yes         | Yes           | Yes        |
| AI business summaries*         | No         | No           | Limited          | Yes         | Yes         | Yes           | Yes        |
| GA4 integration*               | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Google Search Console*         | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Google Business Profile*       | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Reputation monitoring*         | No         | No           | No               | Yes         | Yes         | Yes           | Yes        |
| Competitor intelligence*       | No         | No           | No               | Limited     | Yes         | Yes           | Yes        |
| Marketing intelligence*        | No         | No           | No               | Limited     | Yes         | Yes           | Yes        |
| Multi-client dashboard         | No         | No           | No               | No          | Yes         | Yes           | Yes        |
| Bulk monitoring/scans          | No         | No           | No               | No          | Yes         | Yes           | Yes        |
| Client accounts                | No         | No           | No               | No          | Yes         | Yes           | Yes        |
| Role-based permissions         | No         | Basic        | Basic            | Yes         | Yes         | Yes           | Custom     |
| Agency branding                | No         | No           | No               | No          | Yes         | Yes           | Yes        |
| Custom logo                    | No         | No           | No               | No          | Yes         | Yes           | Yes        |
| Remove Guardian branding       | No         | No           | No               | No          | No          | Yes           | Yes        |
| Custom dashboard branding      | No         | No           | No               | No          | No          | Yes           | Yes        |
| Custom domain                  | No         | No           | No               | No          | No          | Yes           | Yes        |
| Branded emails                 | No         | No           | No               | No          | No          | Yes           | Yes        |
| Branded reports                | No         | No           | No               | No          | Partial     | Yes           | Yes        |
| API access*                    | No         | No           | No               | Limited     | Yes         | Yes           | Yes        |
| Priority support               | No         | Standard     | Standard         | Priority    | Priority    | Priority      | Dedicated  |
| SLA                            | No         | No           | No               | No          | No          | No            | Yes        |

\* Marked features become billable/unlocked only when their Guardian modules are completed. Unmarked features also require implementation verification before being advertised as available. A paid entitlement must never bypass module availability. Accessibility entries do not promise a full compliance audit; current scope remains [basic server-HTML checks](ACCESSIBILITY_MONITORING.md).

## Plan positioning

| Plan                | Customer message                  |
| ------------------- | --------------------------------- |
| Free Audit          | Find out what's wrong.            |
| Starter — $9        | Protect my website.               |
| Growth — $29        | Monitor my digital health.        |
| Pro — $59           | Protect my leads and growth.      |
| Agency — $99        | Manage all my clients.            |
| White Label — $249  | Sell Guardian under my own brand. |
| Enterprise — Custom | Run digital operations at scale.  |

## Engineering requirements when billing resumes

- Centralize plan identifiers, prices, intervals, quotas and feature entitlements; pricing must not be duplicated throughout UI, APIs and workers.
- Support subscriptions, card-free 14-day trials for the five standard paid plans, upgrades, downgrades, cancellations, invoices, failed payments and payment webhooks.
- Enforce entitlements on the server and scheduled workers as well as reflecting them in the UI. Preserve tenant isolation regardless of plan.
- Keep module release availability separate from plan eligibility. Trial access must obey the same module availability gates.
- Treat Enterprise limits and terms as explicitly configured contract values; “Custom” does not mean unlimited by default.

## Decisions still needed before enforcement

These are unresolved details, not changes to the supplied table:

- Define whether quotas are per subscription/organization, per website or per client. Specify numeric “Per client,” “Limited,” “Sample,” “Basic” and “Partial” limits, including API and AI allowances.
- Define Free Audit eligibility/reset rules, trial eligibility/start/expiry behavior, post-trial access, over-limit downgrade behavior, proration and failed-payment grace periods.
- Define AI Insight metering, shared-pool scope, reset periods, failed-request charging and rollover policy.
- Specify MTA-STS, Slack/Teams/Discord/webhook channels and status-page entitlements; these existing roadmap features are absent from this table and must not silently inherit a tier.
- Define DNS/security-header/domain-expiry and accessibility cadences, Starter broken-link frequency, and snapshot availability. Confirm retention/deletion behavior and the distinction between Growth “Basic” accessibility and higher-tier access.
- Define support commitments and Enterprise contractual SLA separately from Guardian's internal incident escalation/SLA controls.
- Confirm currency, tax handling, payment provider, annual billing collection and release availability for every advertised capability.

Updating this specification does not activate checkout, change existing customer access or resume billing implementation.
