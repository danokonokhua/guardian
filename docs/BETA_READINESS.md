# Beta readiness — active phase

Started 28 September 2026 after the scoped basic accessibility phase. Billing remains paused. This phase verifies the existing product with customers and the intended deployment; it does not imply completion of later Google integrations, white-label agency features or rendered accessibility auditing.

## Current evidence

| Area                     | Evidence and status                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic accessibility      | Scoped server-HTML implementation complete; unit, PostgreSQL/queue and browser checks passed, plus a real local-worker scan of example.com. See [scope](ACCESSIBILITY_MONITORING.md).                                                                               |
| Monitoring expansion     | Six initial slices implemented within their documented limits. Richer channel routing/quiet hours, automatic status-page monitor mapping and other documented extensions remain separate work.                                                                      |
| Customer sample          | The [tracker](CUSTOMER_VALIDATION_TRACKER.md) records six completed reviews, meeting the minimum sample of five. Its totals report one owner action and zero confirmed prevented/resolved outcomes.                                                                 |
| Customer outcomes        | Record accurate, negative or unknown outcomes honestly. The PRD does not prescribe a minimum number of positive outcomes. Follow up on assigned remediation and confusing findings; do not infer revenue saved.                                                     |
| Local technical evidence | Latest monitoring-expansion CI passed; local web/database readiness and worker checks passed. Browser QA covers desktop, tablet and mobile.                                                                                                                         |
| Alert receipt            | SMTP email delivery confirmed via Resend (1 October 2026). Real Discord webhook receipt confirmed end-to-end (2 October 2026): direct outbound and pg-boss background worker delivery verified with HTTP 200. Slack/Teams/generic webhook receipt remains optional. |
| Operations               | Backup restoration, support ownership and authenticated customer workflows must be evidenced for the actual beta environment.                                                                                                                                       |

Older documents saying no customer reviews have been collected are superseded by the tracker. Six reviews are not evidence that every expanded feature has been exercised by those customers.

## Reusable read-only deployment check

```bash
npm run beta:check
npm run beta:check -- https://your-beta-host.example
```

The first command defaults to `http://localhost:3000`. Remote origins must use HTTPS. Do not supply credentials, query strings or paths. The command makes five anonymous GET requests with deadlines and no redirects, sends no messages, and changes no customer data:

1. Application liveness.
2. Application **and configured database** readiness; a degraded HTTP 200 is a failure.
3. HTML login page.
4. Rejection of anonymous access to a tenant monitoring endpoint.
5. JSON/no-store 404 for a reserved nonexistent public status-page address.

Output is a JSON technical report. A failed check returns a nonzero exit code. Passing checks explicitly leave authenticated flows, worker recurrence, actual notification receipt, backups and customer outcomes unverified. Keep reports with their timestamp and target; do not relabel a local report as public beta verification.

## Beta execution sequence

1. Identify the beta environment. Apply [deployment guidance](DEPLOYMENT.md), all migrations and the existing encryption key for notification credentials.
2. Run the read-only deployment checks and authenticated browser walkthrough against that target. Verify signup/login, organization/business/website setup, ownership verification, monitoring configuration, findings, recommendations, history and tenant isolation.
3. Verify scheduled checks and one approved notification destination end to end. Resolve sender quota before retrying email; acceptance by a provider alone is not inbox receipt. No test messages or customer outreach are authorized by this document itself.
4. Exercise a backup restoration in an isolated database and record the operator, date and recovery result. Identify who receives operational failures and supports beta participants.
5. Continue the existing customer tracker. Prioritize the documented request for actionable resolution guidance and the uncertainty around CDN/hosting findings. Record issues against reproducible evidence; keep automated remediation outside this beta baseline.
6. Summarize the beta evidence, remaining defects and product decision before starting the next major integration phase. Keep billing paused unless the product owner resumes it.

## Remaining inputs

Local baseline checked at **2026-09-28 21:52:56 UTC** against
`http://localhost:3000`: all five technical checks passed (liveness 200,
configured database healthy, login 200, anonymous tenant request 401,
unpublished status-page request 404 with no-store). This is local deployment
evidence, not a public beta release sign-off.

- The intended public beta URL, or confirmation that this remains a local pilot.
- Destination configuration and an explicit send/test action for delivery verification.
- Current customer follow-up results and deployment operational evidence.

Beta preparation is underway; public beta validation is not yet complete.

Local recovery checkpoint (29 September 2026): the isolated [backup restoration drill](BACKUP_RESTORE.md) initially found four duplicated queue keys. The authorized repair was rehearsed in isolation, preserved all six queue names and 1,392 jobs, removed only superseded metadata, and rebuilt the queue index. A fresh full restore and queue index integrity check passed. Web/worker resumed, all five local readiness checks passed, and the running worker completed an internal system ping. The local recovery blocker is resolved; production backup/permissions/key recovery and real notification receipt remain unverified. Root cause is not yet established.

Phase 13 billing checkpoint (29 September 2026): full billing and subscription infrastructure implemented. Seven-tier plan catalog (FREE / STARTER / GROWTH / PRO / AGENCY / WHITE_LABEL / ENTERPRISE) centrally configured in `config/billing-plans.ts`. Prisma schema extended with `Subscription` and `BillingInvoice` models plus RLS-enforced migrations. Entitlement guards (`assertCanAddWebsite`, `assertCanAddBusiness`, `assertCanAddMember`) enforce plan quotas at the service layer. Billing API routes (summary, checkout, portal, Stripe webhook), public `/pricing` page, and `/billing` tenant portal with usage meters and invoice history are all implemented and tested (648 tests passing). The mock provider supports tests; the Stripe provider activates when `STRIPE_SECRET_KEY` is set. Billing is no longer paused.

Phase 14 SMTP checkpoint (1 October 2026): SMTP email delivery unblocked by switching from Mailtrap (quota exhausted) to Resend. User confirmed inbox receipt of a Guardian alert email. `.env` updated with Resend SMTP credentials (`smtp.resend.com:465`, `SMTP_USER=resend`). No code changes required — `services/notifications/smtp.ts` uses standard nodemailer. For delivery to all recipients, verify a custom sending domain in the Resend dashboard; until then, only the Resend account owner's address receives mail. Real Slack/Teams/Discord/webhook receipt and an authenticated browser walkthrough against the beta environment remain outstanding before public beta sign-off.

Phase 14 Discord webhook checkpoint (2 October 2026): real Discord incoming webhook delivery verified end-to-end. Both direct outbound transport and asynchronous pg-boss worker delivery (`notification.external` queue) succeeded with HTTP 200 and receipt confirmed in Discord. Outbound URL validation accepts both `discord.com` and `discordapp.com` hosts (normalized to `discord.com`). Automated smoke verification tool available in `scripts/notification-destination-smoke.ts`. Slack, Teams and generic webhook receipt remain optional channel choices.
