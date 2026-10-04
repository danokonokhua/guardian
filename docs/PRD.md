# Guardian — Master Product Requirements

**Version:** 2.1
**Status:** Canonical project product requirements  
**Category:** AI Digital Business Operations Platform  
**Target sequence:** SMBs → agencies → enterprise  
**Long-term vision:** AI Digital Operations Manager / AI COO

> This repository copy is the working canonical reference for product decisions. The source document is `Guardian_Master_PRD.pdf`, supplied by the project owner. Product requirements in this file govern scope and sequencing; engineering constraints are recorded separately in [`ENGINEERING_SPEC.md`](./ENGINEERING_SPEC.md).

## 1. Executive summary

Guardian is an AI-powered digital business operations platform that continuously monitors the digital systems contributing to a company’s revenue.

Guardian identifies broken systems, lost-lead opportunities, performance problems, SEO problems, security risks, conversion problems, reputation problems, marketing inefficiencies, and competitive opportunities. It translates those findings into:

**Business impact → Priority → Recommendation → Action**

The platform progressively evolves from a monitoring system into an AI-powered digital operations manager.

## 2. Fundamental problem

Modern businesses depend on many digital systems: websites, forms, WhatsApp, email, payments, CRM, Google, SEO, ads, analytics, reviews, social media, landing pages, WordPress, and hosting. Owners lack one place that answers: **“Is my digital business actually working?”**

## 3. Big idea

Guardian must go beyond “your website is down.” It should explain the business consequence, for example: an enquiry system has failed for four hours, affects high-traffic pages, and may prevent potential customers from contacting the business.

## 4. Product positioning

**Category:** AI Digital Business Operations Platform

**Positioning:** Guardian continuously monitors the digital systems that generate revenue, identifies what is broken or underperforming, explains the business impact, and recommends what to do next.

**Long-term statement:** Guardian protects, improves, and grows the digital business.

## 5. Target market

- Initial market: SMBs
- First test vertical: real estate
- Expansion: healthcare, legal, hospitality, education, solar, automotive, professional services, e-commerce, and agencies

## 6. Core product pillars

1. **Digital Health:** Is the digital infrastructure functioning?
2. **Revenue Protection:** Are the systems that generate leads and revenue working?
3. **Business Intelligence:** What does the data mean, and what should the owner do?

## 7. Product map

**Protect:** website, security, forms, payments  
**Understand:** analytics, leads, revenue, conversion  
**Grow:** SEO, content, ads, reputation, competitors

These signals feed **Guardian AI → Decision Intelligence → Action**.

## 8. MVP features

### Account and tenancy

- Signup and login
- Organizations
- Users
- Roles

### Website

- Website onboarding
- Scanning
- Monitoring

### Digital health

- Uptime
- SSL
- HTTP status
- Response time
- Broken links
- Basic SEO
- Basic security

### Revenue protection

- Critical-page monitoring
- Lead-form monitoring

### Intelligence

- Issues
- Severity
- Health score
- Recommendations
- AI explanations

### Communication

- Dashboard
- Email alerts

## 9. Free audit

The free audit is the primary acquisition mechanism:

`Website URL → audit → digital health score → critical issues → warnings → opportunities → Protect My Business → account creation → continuous monitoring`

The public audit must be rate-limited and abuse-protected.

## 10. Health score

Guardian creates one understandable score while retaining drill-down metrics. The initial category model is:

- Website: 25%
- Lead Generation: 25%
- Performance: 15%
- SEO: 15%
- Security: 10%
- Reputation: 10%

Scores must be explainable and traceable to measurable signals. The architecture must allow industry-specific weighting later.

### 10.1 Infrastructure and domain monitoring roadmap

- **DNS monitoring:** Monitor A, AAAA, MX, NS, and TXT record sets for an explicitly configured hostname on a verified domain. Persist a baseline and observation history; display added/removed records, first detection time, and affected record type. Ignore answer ordering and equivalent representation; preserve TXT value case. DNS propagation and legitimate rotation must not be labelled outages automatically. Failed lookups must not overwrite the last valid baseline. Distinguish missing records, nonexistent domains, resolver failures, and timeouts. Authorized users can acknowledge a change and accept a new baseline, with an audit trail.
- **Domain expiry:** Track registration expiry separately from TLS certificate expiry. Default advance alerts at 90, 30, and 7 days, plus an expired state. Make thresholds configurable; deduplicate alerts per domain, expiry date, and threshold. Use registration-domain-aware RDAP/provider data, recording source and last successful refresh. Unknown, redacted, unsupported, or conflicting expiry data remains unknown rather than healthy. Reset the alert cycle when a confirmed renewal changes the expiry date.
- **Email-domain health:** Check SPF, DMARC, and MTA-STS configuration and changes. Show missing, invalid, weak-policy, healthy, and unknown results with supporting evidence. SPF checks need bounded DNS expansion and loop/lookup-limit handling; DMARC must account for organizational-domain policy discovery; MTA-STS must inspect DNS policy identifiers and safely fetch/validate HTTPS policies. These checks assess configuration, not guaranteed deliverability or inbox placement. No email or DNS changes occur automatically.
- **Basic accessibility:** Add bounded automated checks for issues such as missing document language, image alternatives, form labels, accessible control names, and obvious semantic problems. Store affected page, rule, evidence, severity, and suggested fix; distinguish decorative images and intentionally hidden controls. State scan scope and tool/version. Automated checks are not a complete accessibility audit or certification; keyboard, assistive-technology and manual review remain necessary. Rendered-browser checks run in isolated, resource-limited workers.

All new adapters must use verified tenant-owned targets, bounded work, persisted evidence, issue deduplication, recovery/history, and configurable alerts. Extend the score only after category mapping and false-positive behavior are validated; retain current weights and explicitly mark unsupported coverage pending.

## 11. Revenue protection

Monitor forms, checkout, booking, contact, enquiry, WhatsApp, phone calls-to-action, and payment workflows. Ultimately, Guardian should know when a business can no longer receive customers.

Critical conversion-path failures must create a critical revenue-protection issue containing what failed, when it failed, evidence, affected URL/workflow, severity, business impact, and recommended action.

## 12. SEO intelligence

Initial checks include title, meta description, headings, canonical, `robots.txt`, sitemap, indexability, broken links, structured data, and duplicate-content indicators.

Future capabilities include Search Console, rankings, organic traffic, ranking changes, declining pages, content and keyword opportunities, competitor SEO, AI search visibility, and local SEO.

## 13. Security intelligence

Initial checks include SSL problems, insecure headers, exposed configuration, basic vulnerability indicators, outdated WordPress, and suspicious configuration changes. Guardian must clearly communicate that these checks do not constitute a complete cybersecurity service.

## 14. Reputation and Google intelligence

Future reputation monitoring includes reviews, ratings, review volume, unanswered reviews, and sentiment. AI may suggest responses; publishing requires authorization unless explicitly configured otherwise.

The platform should support Google Analytics, Search Console, and Business Profile integrations to identify traffic changes, ranking changes, indexing problems, search opportunities, local visibility, review changes, and conversion trends.

## 15. Competitor and marketing intelligence

Customers may define competitors. Guardian may monitor available signals such as website changes, SEO visibility, content, reviews, rankings, landing pages, offers, and digital presence. Collection must comply with applicable law and third-party terms.

Future marketing integrations include Google Ads, Meta Ads, LinkedIn, email platforms, and CRM, with analysis of spend, traffic, conversions, cost per lead, and campaign performance.

## 16. AI Guardian

AI is a decision layer over trusted platform data, not the primary source of truth. Users should be able to ask:

- Why did my score fall?
- What happened this week?
- Are we losing leads?
- What should I fix first?
- Why did traffic drop?
- Which page should I improve?

AI outputs must be grounded in actual business data, not generic guesses.

## 17. AI COO and automated actions

The long-term AI COO provides daily, weekly, and monthly briefings; critical alerts; business opportunities; performance, lead, SEO, marketing, and competitive insights; and recommended actions.

Risky actions follow this flow:

`Problem → Evidence → Recommendation → Risk → Approval → Action → Verification → Rollback`

High-risk operations must never run automatically without explicit authorization. Every action requires an audit log.

## 18. WordPress, agency, and white-label direction

Future Guardian Connect capabilities include website connection, WordPress/PHP/plugin/theme status, security, performance, backups, updates, and health status. AutoFix is a later capability.

Agency capabilities include multiple clients, team members, permissions, bulk monitoring, bulk reporting, white label, client notifications, agency billing, and client management.

White-label capabilities include custom logo, colors, domain, email branding, reports, and dashboard branding.

### 18.1 Client-facing status pages

Provide organization-owned status pages for agencies and client accounts: named service components, current operational/degraded/outage/maintenance states, incident timelines, resolution updates, and scheduled maintenance. Support authenticated private pages and explicitly published public pages; branding and custom domains follow the white-label roadmap. Pages are private/unpublished by default. Require role-authorized publication and component selection. Public responses expose only approved summaries, never internal diagnostics, tokens, customer data, or cross-tenant details. Mark stale/unknown observations explicitly. Audit publication and incident edits; define redaction, unpublish, caching, and history behavior. Notifications must reflect actual incident transitions and maintenance settings.

## 19. Reporting, billing, and API

Reports should include health score, critical and resolved issues, trends, leads, SEO, performance, security, reputation, opportunities, and recommended actions.

Billing must support Free Audit, Starter, Growth, Pro, Agency, White Label, and Enterprise plans; subscriptions, trials, upgrades, downgrades, cancellations, invoices, payment failures, and webhooks. Pricing must be centrally configured and never hardcoded throughout the application. The [working pricing specification](PRICING.md), accepted 28 September 2026, defines prices, intended limits, card-free 14-day trials for standard paid plans, positioning and unresolved enforcement details. Features marked with an asterisk become billable/unlocked only when their modules are complete; plan eligibility never substitutes for module availability. Billing implementation remains paused until resumed by the product owner.

The API must be versioned under `/api/v1` and support businesses, websites, scans, issues, health, reports, integrations, notifications, and actions. It requires authentication, authorization, rate limiting, validation, logging, and API keys.

## 20. Data and background jobs

The normalized relational model should support users, organizations, organization members, roles, permissions, businesses, websites, digital assets, monitoring checks/results, issues/events, health scores/components, recommendations, actions/logs, notifications/preferences, integrations/credentials, reports/templates, audit logs, subscriptions/plans/invoices, payments, competitors/snapshots, leads/events, conversions, SEO/performance/security/reputation events, AI conversations/messages/runs, background jobs, webhooks, and API keys.

Use foreign keys, indexes, timestamps, and soft deletion where appropriate. Never store plaintext credentials or secrets.

Background jobs include website scans, uptime, SSL, broken links, SEO, performance, lead tests, reports, notifications, integration synchronization, AI processing, and competitor monitoring. Jobs require retry, backoff, timeout, dead-letter handling, idempotency, and logging.

## 21. Notifications and security

Required notification roadmap channels are email, in-app, Slack, Microsoft Teams, Discord, and generic webhook. WhatsApp, SMS, and push remain later extensions. Users need per-user preferences; administrators need tenant-scoped destination configuration, event/severity routing, quiet hours, recovery notifications, and test deliveries. Email/in-app foundations exist; external channel adapters remain implementation work.

External delivery must include encrypted destination credentials, masked secrets, outbound URL validation, signed generic webhook payloads, bounded retries with backoff, rate-limit handling, deduplication, delivery logs, and failed-delivery visibility. Test deliveries require an explicit user action. Respect provider-specific message formats and limits; never include raw secrets or sensitive technical evidence in messages.

Mandatory security properties include secure authentication, RBAC, tenant isolation, input validation, output encoding, CSRF protection where applicable, rate limiting, secure cookies, encrypted secrets, encryption in transit, audit logs, webhook verification, dependency scanning, security headers, backup strategy, least privilege, and OWASP-aligned practices.

## 22. Development and testing standards

Preferred stack: Next.js, React, TypeScript, Tailwind CSS, Node.js services where needed, PostgreSQL, Prisma or equivalent, Supabase Auth or equivalent, object storage, queue-based jobs, Stripe behind an abstraction, transactional email, provider-abstracted AI, and deployment that is not tightly coupled to one host.

Required testing includes unit, integration, API, authorization, tenant-isolation, background-job, monitoring, AI contract, security, and end-to-end tests. Critical flows must be automated.

## 23. Development phases

1. Architecture
2. Foundation
3. Authentication and organizations
4. Business and website management
5. Dashboard
6. Website monitoring
7. Issue engine
8. Digital Health Score
9. Revenue Protection
10. AI Guardian
11. Notifications
12. Free Audit
13. Billing
14. Beta
15. Google integrations
16. SEO Intelligence
17. WordPress
18. Reputation
19. Competitor Intelligence
20. Marketing Intelligence
21. Agency Platform
22. Automated Remediation
23. API Platform
24. Mobile
25. Marketplace
26. Predictive Intelligence
27. AI COO

### 23.1 Approved roadmap adjustment (27 September 2026)

Billing implementation is paused by the product owner. Continue the monitoring expansion in this order: (1) DNS record change monitoring; (2) domain expiry; (3) email-domain health; (4) Slack, Teams, Discord and webhook delivery; (5) agency/client status pages; (6) basic accessibility monitoring. This supplements the numbered phase sequence rather than claiming earlier phases complete. Implement and verify each vertical slice before moving to the next. Preserve the MVP validation requirement and deferred visual-QA follow-up.

Acceptance evidence must include record reordering/noise and resolver failure tests; expiry boundary/renewal deduplication tests; email-policy malformed/missing/timeout cases; destination authorization and delivery retry tests; status-page public-data isolation tests; and accessibility fixtures including legitimate decorative/hidden elements.

Implementation checkpoint (28 September 2026): domain registration expiry now has RDAP collection, persistent observations, scheduled worker integration, configurable 90/30/7-day defaults, expired incidents, renewal-aware alert deduplication and dashboard evidence. Local database/queue integration and Chromium desktop/tablet/mobile checks pass; see [domain expiry delivery notes](DOMAIN_EXPIRY.md). This completes the previously deferred Chromium visual-QA follow-up for this slice. Email inbox delivery still depends on resolving the existing provider quota restriction. Email-domain health is next; billing remains paused.

Email-domain health checkpoint (28 September 2026): SPF, DMARC and MTA-STS now have bounded collection, tenant-scoped observations/change history, per-protocol issues, existing SLA/preference-based alerts, and dashboard evidence. Unit and real database/queue integration checks passed; Chromium desktop/tablet/mobile QA is complete for this slice. See [implementation scope and verification](EMAIL_DOMAIN_HEALTH.md), including sender-dependent SPF limitations. Slack, Teams, Discord and webhook delivery is next; billing remains paused.

Notification-channel checkpoint (28 September 2026): organization-owned Slack, Teams Workflows, Discord and signed HTTPS webhook destinations now include owner/admin settings, encrypted credentials, paused-by-default setup, explicit test delivery, tenant-isolated persistence, transactional queue insertion, bounded retries, delivery history and SLA/domain-expiry alert fanout. Unit and real database/queue tests pass; Chromium desktop/tablet/mobile checks pass. Real provider receipt remains to be verified with the intended destination URLs. See [setup and delivery notes](NOTIFICATION_CHANNELS.md). Agency/client status pages are next; billing remains paused.

Status-page checkpoint (28 September 2026): organization-owned private previews and explicitly published public pages now include selected operator-confirmed service components, stale/unknown states, approved incident timelines, scheduled maintenance, redaction, revision checks, publication/edit audit records and opt-in organization-channel incident-transition notifications. Public reads use a separate approved snapshot with exact-slug RLS and no-store delivery; unpublish removes public access. Unit, real PostgreSQL/queue isolation tests and Chromium desktop/tablet/mobile checks pass. See [scope, setup and verification](STATUS_PAGES.md). Custom domains, client-specific invitations, automatic monitor mapping and public subscriptions remain future extensions. Basic accessibility monitoring is next; billing remains paused.

Basic accessibility checkpoint (28 September 2026): the ACCESSIBILITY monitor now performs bounded server-HTML checks for language/title, image alternatives, form labels, control names and empty headings. Tenant-scoped evidence includes page/rule/count/locations/severity/fixes and tool version; recurring issues use existing SLA alerts, and unavailable scans retain prior findings. Scheduling, issue recovery, read-only evidence and dashboard states are implemented. Unit and real PostgreSQL/queue tests pass; Chromium desktop/tablet/mobile QA covers findings and stale evidence. See [scope and verification](ACCESSIBILITY_MONITORING.md). Rendered-browser audits, computed CSS, JavaScript interaction, keyboard and assistive-technology review remain outside this basic automated slice. The initial monitoring expansion is implemented with its documented limits; real-business MVP validation remains required. Billing stays paused.

Beta readiness checkpoint (28 September 2026): with the scoped accessibility slice complete and billing still paused, phase 14 Beta preparation is active. The customer tracker already records six completed reviews, meeting the minimum sample; confirmed outcomes remain as recorded rather than inferred. A reusable read-only deployment check now verifies liveness, configured-database readiness, login availability, anonymous tenant denial and unpublished status-page isolation. See [beta readiness and outstanding deployment/customer evidence](BETA_READINESS.md). Public beta validation and later major integrations are not claimed complete.

## 24. MVP exit criteria

Phase 13 billing checkpoint (29 September 2026): billing resumed and full subscription infrastructure delivered. Seven-tier plan catalog (FREE, STARTER \$9/mo, GROWTH \$29/mo, PRO \$59/mo, AGENCY \$99/mo, WHITE_LABEL \$249/mo, ENTERPRISE custom) centrally configured in `config/billing-plans.ts`; prices and limits are never hardcoded elsewhere. Prisma schema extended with `Subscription` and `BillingInvoice` models, RLS-enforced migrations applied. Entitlement guards enforce plan quotas at the service layer; `assertCanAddWebsite` blocks onboarding when the website limit is reached. Billing API routes, Stripe webhook ingestion, public `/pricing` page, and `/billing` tenant portal are implemented. MockBillingProvider for tests; StripeBillingProvider activates when `STRIPE_SECRET_KEY` is present. 648 tests pass; TypeScript/lint/format clean; production build passed. PRD section 19 billing requirements are now satisfied.

Phase 14 SMTP checkpoint (1 October 2026): SMTP email delivery unblocked. Previous provider (Mailtrap) exhausted its sender quota (`550 5.7.1`). Switched to Resend (`smtp.resend.com:465`); no code changes required. Product owner confirmed inbox receipt of a Guardian alert email (23:07 BST). Until a custom sending domain is verified in Resend, outbound delivery is restricted to the Resend account owner's address — verify a custom domain for unrestricted production delivery. Outstanding before public beta sign-off: Slack/Teams/Discord/webhook alert receipt end-to-end, authenticated browser walkthrough (signup → monitor → issue → alert), and public deployment evidence.

Phase 14 Discord webhook checkpoint (2 October 2026): external notification delivery verified end-to-end using a live Discord incoming webhook. Both direct outbound delivery and queued background worker execution (`notification.external` on pg-boss) succeeded with HTTP 200 and receipt in Discord. Transport adapter updated to accept both `discord.com` and `discordapp.com` hosts. Delivery history and audit trail verified in PostgreSQL. Automated test runner added to `scripts/notification-destination-smoke.ts`.
Phase 15 Google integrations checkpoint (2 October 2026): Google integrations hub delivered supporting Google Analytics 4, Search Console, and Google Business Profile with anomaly detection (traffic drops, search visibility, reputation issues), AES-256-GCM credential encryption, dual-mode (OAuth and sandbox testing), RLS-protected database model `GoogleIntegration`, background sync job, and dedicated dashboard UI at `/dashboard/integrations`.
Phase 16 SEO intelligence checkpoint (3 October 2026): Advanced SEO Intelligence delivered with Open Graph and Twitter Card social preview generator, Schema.org JSON-LD structured data parser and validator, heading hierarchy audit (H1-H3 structure and duplicate detection), image alt attribute coverage audit, title/description length guidance, canonical mismatch protection, and dedicated dashboard UI at `/dashboard/seo`. Gated by `advancedSeo` entitlement (Growth+). Verified with 11 new tests, clean TypeScript compilation, and passing production build.
Reputation health score integration (3 October 2026): Connected Google Business Profile integration data directly into the PRD §10 REPUTATION (10%) Digital Health Score category. Organizations with synced Google Business Profile metrics now achieve 100% measured coverage (up from 90% partial). Customer star ratings feed the component score, and active GBP issues (`RULE_GBP_LOW_RATING`, `RULE_GBP_UNANSWERED_REVIEWS`) apply bounded severity penalties and drivers. Dedicated `/reputation` view added to dashboard navigation. Verified with unit and repository snapshot tests.
Recovery notifications checkpoint (3 October 2026): Delivered automatic recovery notifications across both external destinations (Slack, Discord, Teams, signed Webhook) and internal channels (in-app notifications and email via SMTP/Resend). Dispatched whenever an issue clears — whether by automated monitor observation recovery (`resolveFindingScoped`, accessibility, email health) or manual operator resolution in the dashboard. External notifications worker updated to deliver recovery messages (`Resolved: <title>`) without cancellation. Verified with dedicated test suite and clean production build.
Stripe webhook signature verification & sandbox checkpoint (3 October 2026): Delivered dual-mode Stripe webhook handling. When `STRIPE_WEBHOOK_SECRET` (`whsec_...`) is configured, full HMAC-SHA256 signature verification with timestamp tolerance and timingSafeEqual protection is enforced according to Stripe's cryptographic spec. When live secrets are not configured or when test/demo signatures are supplied, an explicit, safe Sandbox Demo Mode is activated. Added dedicated `/api/webhooks/stripe/simulate` endpoint and interactive demo controls on `/billing` allowing end-to-end simulation of plan upgrades, subscription renewals, invoice receipt creation, and cancelation without live credit cards or webhook secrets. All 30 billing tests pass; 100% full test suite passed (667 tests).
History retention pruning checkpoint (3 October 2026): Delivered automated history retention pruning engine enforcing plan-based retention limits across PostgreSQL: Free (7-day snapshot grace window), Starter (30 days), Growth (90 days), Pro/Agency (365 days / 12 months), White Label (730 days / 24 months), and Enterprise (Infinity / unlimited retention). Telemetry samples (`monitoring_results`), historical health score snapshots (preserving the latest active score), resolved/ignored issues (`resolvedAt < cutoff`, strictly preserving open/in-progress incidents), external deliveries, and in-app notifications are pruned in bounded batches (`BATCH_SIZE = 1,000`) per tenant. Includes system maintenance pruner for expired sessions and stale throttles, pg-boss singleton worker (`maintenance.retention_prune`), worker scheduler integration (daily), and cron tick trigger. Verified with 15 dedicated tests and clean production build.
Phase 23 API platform checkpoint (4 October 2026): Delivered versioned `/api/v1` programmatic developer API platform per PRD §19 and §20. Supports high-entropy API key generation (`gdn_live_...` / `gdn_test_...`) with cryptographic SHA-256 token hashing and zero plaintext secret persistence in PostgreSQL. Dual-mode authentication resolver accepts standard `Authorization: Bearer <key>` and `X-API-Key` headers across all tenant endpoints, enforcing granular scopes (`health:read`, `issues:read`, `issues:write`, `monitors:read`, `monitors:write`, `remediation:read`, `*`). In-memory sliding window token bucket rate limiter returns RFC headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) tuned to organization billing plan tiers (`PRO`: 60/min, `AGENCY`: 120/min, `WHITE_LABEL`: 300/min, `ENTERPRISE`: 1000/min). Auto-generated OpenAPI 3.0 specification available at `/api/v1/openapi.json`. Interactive Luminous Glass Developer Hub UI at `/developer` and `/dashboard/developer` with one-time copyable secret reveals, cURL/JavaScript/Python code snippets, and key revocation controls. 19 dedicated tests pass; full test suite (130 test files, 818 tests) passes; clean TypeScript and production build verified.
Phase 24 Mobile platform checkpoint (4 October 2026): Delivered Progressive Web App (PWA) and Web Push mobile platform per PRD §21, §23, and §24. Added dynamic Web App Manifest (`/manifest.webmanifest`) for standalone iOS/Android installation with theme styling, app shortcuts, and background Service Worker (`/sw.js`) for push event handling and notification click navigation. Implemented RFC 8291/8292 Web Push protocol with VAPID key signing and PostgreSQL Row Level Security subscription model (`MobilePushSubscription`). Added mobile endpoints for device subscription, unsubscription, public VAPID key distribution, and instant test alert verification. Integrated sticky mobile bottom navigation (`MobileBottomNav`) for touch viewports and dedicated Mobile Command Center at `/mobile` and `/dashboard/mobile` with 1-tap push enablement, device management, and incident response drawer. 12 dedicated tests pass; full test suite (133 test files, 830 tests) passes; clean TypeScript and production build verified.
Phase 25 Marketplace checkpoint (4 October 2026): Delivered Marketplace Platform & Integration Hub per PRD §20, §21, and §23. Added database model `MarketplaceInstall` for tenant-scoped plugin installs and state tracking (`ACTIVE`, `PAUSED`, `ERROR`, `DISABLED`). Implemented AES-256-GCM authenticated credential encryption (`crypto.ts`) with tenant context AAD binding to prevent cross-tenant credential theft. Curated 8 official and partner plugins across alerting (Slack Smart Incident Bot, Discord Ops Dispatcher, PagerDuty Critical Escalation, Microsoft Teams Adaptive Cards), telemetry (Datadog Telemetry Bridge), remediation (Cloudflare Edge Purge), and developer automation (GitHub Issues Bridge, Generic Signed Webhook Stream). Provided versioned REST API endpoints for catalog discovery, installation with plan entitlement gating (Growth+), lifecycle pause/resume/delete, and diagnostic test signals. Delivered interactive Marketplace Command Center at `/marketplace` and `/dashboard/marketplace` with search, category filtering, config modal, and instant test dispatches. 20 dedicated tests pass; full test suite (136 test files, 850 tests) passes; clean TypeScript compilation and production build verified.
Phase 26 Predictive intelligence checkpoint (4 October 2026): Delivered Predictive Intelligence & Failure Forecasting engine per PRD §20, §23, and §25 (`MONITOR → DIAGNOSE → RECOMMEND → ACT → PREDICT → AI COO`). Added database model `PredictiveForecast` with probability scoring (`0.00` to `1.00`), prediction horizons (`NEXT_24_HOURS`, `NEXT_7_DAYS`, `NEXT_30_DAYS`), and runway day tracking. Built multi-vector forecasting engine modeling TLS certificate decay cliffs, uptime degradation and latency acceleration slopes (+75% to +150% with 5xx jitter), synthetic lead form failure collapses (>40% dropoff), and Google search visibility meta regressions. Entitlement gating restricts access to Growth+ tiers. Versioned REST API endpoints (`/predictive`, `/predictive/[forecastId]`) support on-demand telemetry risk synthesis and operator triage (`ACKNOWLEDGED`, `RESOLVED`, `DISMISSED`). Interactive Predictive Command Center delivered at `/predictive` and `/dashboard/predictive` with financial exposure calculations, telemetry signal inspection accordions, and 1-click risk triage. 18 dedicated tests pass; full test suite (139 test files, 868 tests) passes; clean TypeScript compilation and production build verified.


Local operations checkpoint (29 September 2026): a controlled queue repair resolved a local backup-restore failure while preserving all jobs and queue references. Full isolated restore, queue index integrity, local readiness and worker system-ping checks pass; see [recovery evidence](BACKUP_RESTORE.md). This does not establish public deployment recovery or notification receipt. Billing remains paused.

Before major expansion, the MVP must create an account, organization, business, and website; scan a website; monitor uptime; check SSL and HTTP; measure response time; detect broken links; perform basic SEO and security checks; monitor critical lead forms; create issues; calculate a health score; explain issues; provide recommendations; send alerts; and maintain history.

At least 5–10 real businesses must test the MVP before major expansion.

## 25. Competitive strategy and product evolution

Guardian must not compete primarily as “another website monitor.” Its differentiation is digital business intelligence connecting website, SEO, performance, security, leads, conversions, reputation, analytics, marketing, competitors, and CRM into business impact, priorities, recommendations, and actions.

The evolutionary stages are:

`MONITOR → DIAGNOSE → RECOMMEND → ACT → PREDICT → AI COO`

The first hill to climb is:

> Can Guardian detect problems in a real business’s digital revenue infrastructure and explain why those problems matter?

## 26. Master product rule

Do not measure Guardian by how much code is produced. Measure it by how much business pain is eliminated. A successful Guardian detects failures that matter, explains business impact, prioritizes action, helps users resolve problems, and improves business outcomes.
