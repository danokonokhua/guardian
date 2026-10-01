## Basic accessibility monitoring: 28 September 2026

Monitoring now offers Basic accessibility (HTML checks), with supported-rule counts, source-line locations, severity, fixes, scan scope/version and retained stale evidence on unavailable checks. The UI explicitly separates this bounded server-HTML scan from a rendered or manual accessibility audit. See [delivery notes](ACCESSIBILITY_MONITORING.md). The initial monitoring expansion is implemented within its documented scope; real-business MVP validation remains required and billing stays paused.

## Agency/client status pages: 28 September 2026

Dashboard navigation now includes Client status pages. Owners/admins manage approved components, incident timelines, maintenance windows, publication, redaction and audit history; active organization members can view private previews. Public pages follow the Guardian design and expose only selected content. Chromium desktop/tablet/mobile verification and screenshot review passed. See [delivery notes](STATUS_PAGES.md) for manual confirmation, cache/withdrawal behavior and notification limits. Basic accessibility monitoring is next; billing remains paused.

## Notification destinations: 28 September 2026

Settings > Alerts now includes owner/admin organization destinations for Slack, Teams Workflows, Discord and signed HTTPS webhooks. Creation starts paused; explicit test, enable/pause, removal and the latest five delivery outcomes are available. Credentials are encrypted and never returned to the browser. Chromium desktop/tablet/mobile verification passed, including save, pause persistence and failure history. See [setup and delivery notes](NOTIFICATION_CHANNELS.md). Real provider receipt still requires the intended destination URLs and a Settings test. Status pages are next; billing remains paused.

﻿# UI implementation handoff

## Email-domain health: 28 September 2026

Dashboard monitoring now includes SPF, DMARC and MTA-STS evidence with independent healthy/missing/invalid/weak/unknown states, policy disclosures, domain-scope selection, last checked time, stale evidence and change summaries. Chromium desktop/tablet/mobile tests and screenshot review passed. See [delivery notes](EMAIL_DOMAIN_HEALTH.md) for protocol limits, integration evidence and alert behavior. Notification-channel expansion is next; billing remains paused.

## Domain expiry: 28 September 2026

Domain registration expiry is implemented in the monitoring dashboard with configurable alert thresholds, registry source, checked time, expiry date, and unknown/stale evidence. Chromium desktop/tablet/mobile checks passed, including threshold persistence without overwriting registry evidence. Backend integration covers concurrent checks, shared-domain deduplication, expired state, renewal, transactional notification insertion, worker routing and tenant isolation. See [delivery notes](DOMAIN_EXPIRY.md). Historical deferred-QA entries below do not apply to this verified slice. Billing remains paused; email-domain health is next.

## Visual browser verification: resolved for the current Chromium baseline

On 2026-09-27, Playwright restored browser-based verification independently of the unavailable computer-use connector. Desktop (1440x1000), tablet (768x1024), and mobile (390x844) runs passed across 17 implemented routes, with authenticated DNS/settings interactions and loading/error checks. Screenshot review found and fixed mobile assignee-dropdown overflow and cramped tablet signup layout. See [the QA report](qa/2026-09-27/REPORT.md) for evidence, reproduction steps and scope limits. Earlier deferred-status entries below are historical.

## Current implementation

Shared branding (user-supplied shield JPG), homepage/audit, authentication, dashboard, onboarding/verification, health/SEO/security/lead-form views, notifications/preferences, SLA controls, and incident detail disclosures are implemented. The current Chromium desktop/tablet/mobile baseline has now been reviewed.

Executive overview and operational briefings are now implemented using existing health/recommendation evidence. Type checking and lint passed; automated empty-state and dashboard checks are included. Do not fabricate AI generation, audio, financial telemetry, automated remediation, or action ledgers. Remaining unsupported product areas include billing, reputation, agency workflows, WordPress and orchestration.

Reference inventory: ../design/stitch/SCREEN_MAP.md. Development preview previously ran at http://localhost:3001; verify availability before sharing it.

## Phase 13 — Billing & subscriptions (complete): 29 September 2026

Full billing infrastructure implemented: seven-tier plan catalog (FREE / STARTER / GROWTH / PRO / AGENCY / WHITE_LABEL / ENTERPRISE) in `config/billing-plans.ts`; `Subscription` and `BillingInvoice` Prisma models with RLS-enforced migrations; entitlement guards (`assertCanAddWebsite`, `assertCanAddBusiness`, `assertCanAddMember`) at service layer; billing API routes (GET summary, POST trial/change_plan, checkout, portal, Stripe webhook); public `/pricing` page with monthly/annual toggle and 7-tier cards; `/billing` tenant portal with trial countdown, usage meters, plan catalog and invoice history. MockBillingProvider (tests) and StripeBillingProvider (live) selected automatically by `getBillingProvider()`. 648 tests passing (8 entitlement, 4 provider, 5 API route tests added). TypeScript/lint/format clean; production build passed. Billing is now active; `services/websites/service.ts` enforces plan quotas on onboarding.

## Phase 14 — SMTP email delivery resolved: 1 October 2026

Mailtrap sender quota exhausted (`550 5.7.1`). Resolved by switching to Resend SMTP. `.env` updated: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASSWORD=re_...`. No code changes required; `services/notifications/smtp.ts` uses standard nodemailer. Guardian alert email received in inbox (confirmed by product owner, 1 October 2026 23:07 BST). Until a custom sending domain is verified in Resend, delivery is restricted to the Resend account owner's address. Verify a custom domain for unrestricted outbound delivery to all recipients. Remaining beta outstanding items: Slack/Teams/Discord/webhook alert receipt end-to-end, authenticated browser walkthrough, and public deployment evidence.


## Roadmap update: 27 September 2026

Billing is paused by explicit user instruction. PRD v2.1 adds DNS (A/AAAA/MX/NS/TXT), domain expiry (90/30/7-day defaults), SPF/DMARC/MTA-STS email-domain health, agency/client status pages, basic accessibility monitoring, and email/Slack/Teams/Discord/webhook channels (retaining in-app).

Development started with lib/dns/records.ts and lib/dns/collector.ts: bounded collection and normalized record-set comparison. These are backend building blocks, not a live scheduled monitor. Next: tenant-scoped baseline/history storage, DNS monitor type migration, authorized configuration/baseline acceptance, scheduler and issue integration, UI, integration tests. Keep the last valid baseline on UNKNOWN responses; first observations establish baselines rather than firing change incidents. Validate false-positive behavior before changing health scoring.

Visual QA remains deferred as previously requested.

## DNS monitoring integration

DNS is registered as a monitor type with migration db/migrations/202609270001_dns_monitor. The generic scheduler dispatches it; verified-hostname collection flows through persisted MonitoringResult history and monitor.dns issues. Existing SLA escalation/preferences supply alert delivery. Accepted baseline/latest observations live in tenant-scoped monitor configuration; direct configuration replacement is rejected for DNS. Authorized acceptance requires the exact displayed observation timestamp, rejects unknown observations, and appends a baseline-acceptance audit record. The next successful scheduled check recovers the DNS issue.

UI: Dashboard > Monitoring > DNS record changes; expand DNS records and baseline to review and accept evidence. The monitored hostname is the verified website hostname (apex and other subdomains are not inferred). Score weights are unchanged.

Deployment: generate Prisma client, apply migration with npm run db:deploy against the intended database, restart web and worker, configure a DNS monitor on a verified website and run a check. Confirm persistence, subsequent change issue, acceptance and recovery, and escalation delivery. Local database inspection failed during implementation; do not claim a live scheduled run until validated. Visual QA remains deferred.

## Database blocker resolved and DNS queue validation

The migration failure was P1000 authentication failure on DIRECT_URL, not database unavailability. DATABASE_URL authenticated against the same local guardian_test database at 127.0.0.1:56032. Updated the ignored local .env DIRECT_URL to the working local connection without printing credentials. Applied the pending notification runtime grants and DNS enum migrations; migration status reports up to date.

Added tests/jobs/dns-lifecycle.integration.test.ts. With DNS_LIVE_TEST=1 and local .env loaded, it exercises real PostgreSQL and a real isolated pg-boss queue: initial baseline, changed A record, persisted DNS issue, baseline-acceptance API, recovery and four history records. DNS observations and authentication are controlled test fixtures. Isolated queue schema and tenant fixtures are cleaned up. This does not prove actual external DNS recurrence, non-owner/RLS enforcement, or outbound notification delivery; those remain separate validation. Existing Docker web/worker images have not been rebuilt by this change.

## Follow-up operational validation

The DNS lifecycle integration test now also verifies real queued in-app SLA delivery, duplicate suppression, and no escalation after recovery. Email is disabled for the disposable test recipient. SMTP connection and authentication succeeded from the existing Docker worker; no email was sent, so inbox delivery remains unverified.

Windows' configured DNS resolver timed out for A/AAAA/MX/NS/TXT, including outside the sandbox. Docker's resolver successfully returned public DNS responses. This exposed null-MX handling: Node returns an empty exchange for the DNS root. The collector now records it as `0 .`, and normalization preserves it across repeated baseline comparisons. Regression tests cover this case.

Opt-in checks (load the local `.env` without printing it): `DNS_LIVE_TEST=1` runs `tests/jobs/dns-lifecycle.integration.test.ts`; `DNS_EXTERNAL_TEST=1` runs `tests/dns-collector.integration.test.ts`; `DNS_RUNTIME_TEST=1` runs `tests/jobs/dns-runtime.integration.test.ts`. The runtime test requires a running worker against the same database and waits for two automatic external-DNS observations. It creates a disposable tenant with a one-minute test interval, then removes its dispatch entry and fixtures. It does not modify customer monitors or send email. The Windows external-collector test currently fails because of resolver timeouts.

Dockerfile now copies `public/` into the runtime image, including the Guardian logo. Billing remains paused and visual browser QA remains deferred.

The rebuilt containers exposed old runtime configuration using the PostgreSQL superuser. Switched web/worker to the existing `guardian_app` role (NOSUPERUSER/NOBYPASSRLS), populated the missing ignored local `POSTGRES_APP_PASSWORD`, and applied the existing deployment grants to `guardian_jobs` tables/sequences/default privileges. The app readiness endpoint reports application/database healthy and the logo returns HTTP 200. The actual collector also completed two successful external DNS reads inside Docker; Windows resolver timeouts are environment-specific.

After the user authorized a recipient, the email send was attempted through the configured production provider. SMTP rejected it with `554 5.7.1`: demo domains can only send to the provider account owner's email address. No test message was delivered. A verified sending domain or a provider-authorized test recipient is required before inbox delivery can be verified. Connection/authentication success alone does not establish delivery.

Final deployed recurrence check passed (`tests/jobs/dns-runtime.integration.test.ts`, approximately 175 seconds): the actual Docker scheduler and restricted-role worker collected and persisted two successful public DNS observations, with an accepted null-MX baseline. No collector, scheduler or worker mocks are used in this test. The disposable fixture and dispatch entry were removed. An earlier attempt timed out while runtime credentials/grants were being repaired; the clean rerun passed. Targeted automated validation: 27 unit tests, the real queue/lifecycle/in-app integration test, TypeScript, targeted lint and production Docker builds passed. Both local Docker images were rebuilt and restarted; the normal Compose configuration now uses the verified application-role password from ignored `.env`. Visual QA stays deferred, billing stays paused, and SMTP inbox delivery remains blocked as described above.

Follow-up email test: the user supplied the provider account-owner recipient. The production SMTP provider rejected that attempt with 550 5.7.1, 'Sending usage of this domain has reached its limit.' No test email was delivered. The sender domain's sending allowance must be restored or a verified sender with available allowance configured before retrying; inbox delivery remains unverified.

## DNS evidence UI follow-up

PR #1's original commit passed GitHub CI. Replaced raw DNS JSON with per-record accepted/latest comparisons, explicit added/removed labels, last-observation time, waiting/error states, and acceptance controls disabled for incomplete or unchanged evidence. Added three component tests; all seven targeted DNS/monitoring UI tests passed, together with TypeScript and targeted lint. Browser inventory now initializes but exposes no browsers; both in-app and Chrome creation return 'Browser is not available'. Desktop/mobile visual inspection therefore remains incomplete. Domain-expiry development remains the next phase after this review gate; no merge has been performed.
