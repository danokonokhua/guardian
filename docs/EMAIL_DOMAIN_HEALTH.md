# Email-domain health

Implemented 28 September 2026 for the PRD monitoring expansion: SPF, DMARC and MTA-STS configuration checks, persisted observations and changes, independent policy issues, existing SLA notifications, and dashboard evidence.

## Use

Add **Email-domain health (SPF, DMARC, MTA-STS)** in dashboard monitoring for a verified website. Select its registered domain (default, such as `example.com`) or exact verified hostname (such as `mail.example.com`). Daily checks are the default, with a 60-minute minimum. The policy domain is fixed when creating the monitor; recreate the monitor to choose a different scope. No arbitrary remote URL or unrelated email domain can be configured.

Each protocol displays **healthy**, **missing**, **invalid**, **weak policy**, or **unknown**, with the observed policy and source. Unknown evidence retains the last confirmed state and does not resolve existing issues. The current card highlights changes since the last confirmed observation; each check also persists its evidence and change list in monitoring history. A first observation establishes comparison state. Healthy configuration changes are recorded, not treated as outages.

Missing, invalid and weak policies create one issue per protocol/domain/website. Known healthy observations resolve that protocol's issue; later regressions reopen it. Existing organization SLA settings and notification preferences govern alerts to owners/admins, including repeat suppression. These are SLA-timed alerts, not a new immediate-send mechanism. Email delivery still depends on resolving the previously observed sender-domain quota restriction. Unknown results do not create new policy-defect incidents from absent evidence.

## Scope and bounds

- SPF: syntax, multiple records, IP/prefix validity, recursive include/redirect inspection, cycle detection and a ten DNS-term expansion ceiling. Policies requiring sender-specific `a`, `mx`, `exists`, PTR or macro evaluation remain unknown; Guardian does not infer a healthy sender authorization from partial analysis. An exceeded worst-case expansion is unknown rather than claiming every sender necessarily hits SPF's runtime limit. The collector has a separate 40-query cap, shared query cache, 15-second DNS budget and bounded response counts/lengths.
- DMARC: direct policy, bounded DNS hierarchy discovery (at most eight names), organizational/PSD boundaries, inherited subdomain policy, alignment-tag validation and weak-policy reporting. Testing and legacy partial-enforcement tags are surfaced conservatively. Malformed published records are flagged for repair rather than silently declaring an inherited configuration healthy. Only existing verified domain scopes are evaluated; non-existent-domain policy (`np`) is syntax-checked, not exercised against a message.
- MTA-STS: DNS policy identifier, fixed HTTPS policy URL, required fields/modes, MX patterns and coverage of published MX hosts. Fetching uses the existing public-address validation and IP-pinned HTTPS helper, an eight-second HTTP timeout, and a 64 KiB response cap. Redirects and arbitrary record-supplied URLs are not followed. Missing HTTP policy after an advertised identifier is invalid; network/TLS failures and incomplete retrieval remain unknown. `testing`, `none`, zero cache lifetime and absent receiving MX hosts do not receive a healthy verdict.

These are configuration checks, not a complete receiver implementation or deliverability test. No email is sent and no DNS is changed. SMTP connectivity, STARTTLS, MX certificate validation, DKIM signatures, DMARC message alignment, reporting-destination authorization and report ingestion are outside this slice. SPF sender-specific evaluation and MTA-STS policy-cache simulation are also outside scope. Health-score weights are not changed.

Primary references: [SPF RFC 7208](https://www.rfc-editor.org/rfc/rfc7208), [DMARC RFC 9989](https://www.rfc-editor.org/rfc/rfc9989), and [MTA-STS RFC 8461](https://www.rfc-editor.org/rfc/rfc8461). The implementation uses current DMARC hierarchy discovery rather than assuming the obsolete RFC 7489 two-query algorithm.

## Verification and deployment

Migration `202609280002_email_health` adds `EMAIL_HEALTH` to the monitor enum. Observations use existing tenant-protected monitor/result/issue tables; client configuration cannot overwrite server-owned evidence. The local migration is applied. Deploy updated web **and worker** code with generated Prisma and run `npm run db:deploy` before using the new type.

- Policy/configuration tests: 29 passed (malformed/missing/timeout cases, SPF loop/limits, DMARC hierarchy, MTA-STS policy and MX validation).
- Real PostgreSQL/pg-boss integration passed: persistence, repeat issue deduplication, unknown preservation, per-protocol recovery, change history, paused monitors, worker routing, RLS isolation and email opt-out in SLA alert routing. Run `$env:EMAIL_HEALTH_LIVE_TEST='1'; node --env-file=.env node_modules/vitest/vitest.mjs run tests/jobs/email-health.integration.test.ts` in PowerShell. Fixtures are disposable; no test email is sent.
- Full unit suite: 550 passed, 18 opt-in tests skipped. Focused policy and live integration rerun: 30 passed.
- Chromium desktop/tablet/mobile suites passed, including expanded policy evidence and unknown/stale states. Screenshots were visually reviewed. See `qa/2026-09-28/email-health-*.png`.
- Windows DNS smoke returned unknown for all three protocols due to the local resolver restriction; this must not be reported as healthy public-DNS verification.
- A read-only Linux worker smoke against `google.com` completed on 28 September: SPF weak policy, DMARC healthy (`reject`), and MTA-STS healthy with MX coverage. No email was sent. This validates public DNS/HTTPS collection in the worker environment independently of deterministic fixtures.

Next approved slice: Slack, Teams, Discord and webhook notification delivery. Billing remains paused.
