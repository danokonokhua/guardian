# Local live database and monitoring validation — 21 September 2026

Scope: PRD MVP monitoring, issue lifecycle, notifications, and tenant isolation.
No deployment, real-site mutation, or external email delivery was performed.

## Environment and evidence

- Separate PostgreSQL 16 container: `guardian-validation-20260920`.
- Loopback-only port: `127.0.0.1:56042`; disposable database: `guardian_test`.
- All 17 migrations applied, including notification runtime grants.
- Application queries use `guardian_app`; migrations and pg-boss setup use the
  isolated database owner. No real monitoring database is used.
- The integration suite has 13 tests across tenant isolation, job execution,
  and the monitoring lifecycle.

Final results: 489 unit/API/UI tests passed; all 13 live integration tests
passed in a separate database-enabled run. The four monitoring lifecycle tests
also passed an immediate repeat run. TypeScript, changed-test lint, formatting,
and diff whitespace checks passed.

## Verified lifecycle

1. A due dispatch is scheduled once; an immediate second scheduler run finds
   no due work.
2. The worker records HTTP 200 as UP.
3. Repeated HTTP 503 checks produce one HTTP-status incident.
4. An aged incident triggers one queued in-app SLA notification; an immediate
   duplicate escalation is suppressed. Email preferences are disabled for the
   synthetic user before testing.
5. Notification rows and preferences are invisible without a tenant context
   and from another tenant context.
6. HTTP 200 recovery resolves the HTTP incident and records resolution history.
7. Resolved incidents produce no additional SLA escalation.
8. A subsequent failure reopens the same incident and records reopening history.

## Fixes made during validation

- Replaced the RLS test's `npx` migration launcher with the installed Prisma CLI
  using the current Node executable; aligned the setup timeout with migration
  execution time.
- Repaired the monitoring HTTP fixture: production blocks localhost by design.
  This suite substitutes only the outbound request boundary with a fetch to the
  exact local fixture origin. PostgreSQL, pg-boss, workers, incidents, and in-app
  notification persistence remain real. Production SSRF protection is unchanged.
- Added a forward migration granting the existing `guardian_app` role table DML
  access to notification preferences and in-app notifications. Existing forced
  RLS policies remain in place; no superuser or RLS bypass is granted.
- Assigned fresh fixture IDs on each run so retained pg-boss singleton windows
  do not suppress a later validation run. No production deduplication rule changed.

## Remaining verification boundaries

This is a backend lifecycle integration test, not a browser-to-production E2E
certification. It does not prove public-site connectivity from Oracle, delivery
to a real email inbox, production scheduler uptime, browser dashboard behavior,
or customer-confirmed business outcomes. Those remain separate validation gates.
The synthetic incident's age is adjusted to test SLA escalation without waiting
for a real SLA interval. It does not assert immediate failure/recovery emails.

Changes and migrations are local; they have not been pushed or deployed.

## Browser and external email follow-up

- Port 3000 serves an older UI without signup links; the existing current
  development server on port 3001 shows homepage signup and audit links.
- The signup page opens with the expected fields, and login has signup links.
- Authenticated dashboard walkthrough awaits user sign-in; no claim of browser
  end-to-end completion is made.
- The configured SMTP provider rejected the requested verification message at
  DATA with `550 5.7.1 Sending usage of this domain has reached its limit.`
  A diagnostic retry received the same rejection. Inbox delivery is not verified.
  The sender-domain quota needs resolution before another send is attempted.
- A reusable `scripts/email-delivery-smoke.ts` invokes the actual SMTP adapter
  with an explicit recipient and reports provider rejection details without
  printing credentials. It does not prove inbox placement.
