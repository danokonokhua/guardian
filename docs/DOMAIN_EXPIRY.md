# Domain registration expiry

Implemented 28 September 2026 for the PRD monitoring expansion. Registration monitoring is separate from SSL certificate expiry.

## Use

On the dashboard, add a **Domain registration expiry** monitor for a verified website. Daily checks are the default; the minimum interval is 60 minutes. The existing scheduler/worker must be running. Edit advance-alert days in the monitor card (default 90, 30, 7; one to six unique whole-day values from 1 to 365). The card shows registry expiry, source and check time. A failed refresh displays unknown and retains the last successful evidence as stale.

Collection derives the registered domain using the public suffix list, obtains its registry endpoint from [IANA's RDAP bootstrap](https://data.iana.org/rdap/dns.json), and reads matching top-level expiration events defined by [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083.html). It does not follow referrals or redirects. Requests use existing public-address validation/pinning with an eight-second HTTP timeout and 256 KiB response cap. Raw registry responses and registrant information are not stored. Unsupported private hosting suffixes, missing/redacted/conflicting dates and failed lookups remain unknown.

## Alert behavior

- Each check uses the most urgent currently crossed threshold. First enabling at six days produces the seven-day warning; it does not backfill 90- and 30-day alerts. Expiry itself is threshold zero.
- One alert claim per organization, registered domain, expiry date and threshold. Multiple monitored subdomains share this ledger. More urgent warnings supersede less urgent warnings; a sibling with a different policy cannot clear a more urgent warning.
- A confirmed changed expiry date resolves the old cycle and permits alerts for the new date. Unknown evidence never resolves an existing warning. Manually resolved/ignored issues do not repeatedly notify in the same cycle.
- Active owners/admins receive notifications through enabled in-app/email preferences. Ledger insertion and pg-boss notification insertion share one transaction; failures roll back together. Delivery retries use the existing notification worker. SLA repeat escalation excludes expiry incidents to preserve once-per-threshold behavior.
- Paused/unverified monitors do not collect. Threshold edits preserve server-owned observations. This slice does not change health-score weights.

## Deployment

1. Install dependencies and generate Prisma with `npm ci`. Stop local processes holding the Windows Prisma DLL first if necessary.
2. Apply `npm run db:deploy`; migration `202609280001_domain_expiry` adds the monitor enum and tenant-protected alert ledger.
3. Build/restart both web and worker with the updated code. Rebuilding only the web UI leaves the old worker unable to process this monitor type.
4. Keep the existing scheduler and notification worker running. Enable a monitor only for a verified website.

The local database migration is applied. Existing Docker images need rebuilding when deploying this source. SMTP connection/authentication previously passed, but actual email delivery was rejected by the provider's sender-domain quota; this feature does not resolve that provider limit. Do not describe email inbox delivery as verified. Registry dates can differ from registrar billing deadlines and should be confirmed with the registrar.

## Verification

- Parser/configuration tests: domain normalization (IDN and multi-label public suffixes), invalid dates, redaction/conflicts, exact threshold boundaries, strict server-state protection and minimum check frequency.
- Collector tests: IANA endpoint selection, registered-domain lookup, HTTP failure and unsupported domains.
- Opt-in real PostgreSQL/pg-boss integration: concurrent sibling checks, deduplication, escalation, unknown preservation, transaction rollback, expired state, renewal, authoritative worker routing and FORCE RLS ledger isolation. Run `$env:EXPIRY_LIVE_TEST='1'; node --env-file=.env node_modules/vitest/vitest.mjs run tests/jobs/domain-expiry.integration.test.ts` in PowerShell. Fixtures disable email and are removed afterward.
- Read-only live lookup of `www.example.com` returned registered domain `example.com`, expiry `2027-08-13T04:00:00.000Z`, from Verisign RDAP.
- `npm run test:visual`: all three Chromium viewport suites passed (1440x1000, 768x1024, 390x844), including saved thresholds, preserved evidence, unknown/stale states and overflow checks. Screenshots were visually inspected. Representative evidence is in `qa/2026-09-28/`. This is not Safari/Firefox certification.
- Full existing test suite: 518 passed, 17 skipped; subsequent expiry-focused tests: nine passed, including opt-in integration. Production build, type checking and lint passed.

Next approved slice: email-domain health (SPF, DMARC and MTA-STS). Billing remains paused.
