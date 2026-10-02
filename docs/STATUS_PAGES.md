# Agency/client status pages

Implemented 28 September 2026. Open **Client status pages** in the dashboard navigation, or `/status-pages`.

## Create and publish

1. Create a named page and a unique address slug. It starts private; active members of the owning organization can view its preview. Owners and admins manage content and publication. A private page is not a secret public link, and access is organization-wide rather than a separate client invitation system.
2. Add named service components. Choose their confirmed state and explicitly select **Include on published page** for each service that clients should see. There is no automatic import of internal monitoring diagnostics, hostnames, issues or customer records.
3. Add approved descriptions, incident summaries and maintenance windows. Review the preview. An incident or maintenance entry is excluded if any affected component is hidden.
4. Choose **Publish page** and confirm publication. The public address is `/status/<slug>`. Subsequent edits immediately update the published snapshot; they are not a separate draft.
5. Use **Unpublish page** to remove the public snapshot. New public requests return 404. Open pages poll every 30 seconds and refresh when their tab becomes visible. Network failures are disclosed, and offline or already downloaded copies cannot be recalled.

The slug is immutable. Pages are limited to 20 per organization, 20 components per page, 100 incident records, 100 maintenance records and 100 updates per incident. There is no page deletion or automatic history pruning in this release; unpublish pages that should no longer be public. Redact obsolete incident/maintenance entries when the history limit is reached.

## Service states and history

Service states are **operator-confirmed**, not live monitor results. Available states are operational, degraded, outage, maintenance and unknown. Confirmations older than 24 hours become unknown; they never remain green indefinitely. Saving a component confirms its current state again. Incident updates do not automatically change a component: confirm recovery separately after resolving an incident.

Incident timelines start at investigating and support identified, monitoring and resolved updates. Resolved incidents are closed; create a new incident for a recurrence. Additional summaries in the same state remain in the timeline. Redacting an incident removes its entire visible timeline rather than preserving potentially sensitive text in an audit snapshot.

Maintenance windows are entered in the operator's local time and displayed in UTC. During a non-cancelled window, affected components show maintenance unless a known outage or degraded state takes precedence. Ending a window does not confirm recovery; the underlying component state and its freshness still apply. Cancelled windows remain in history. **Redact maintenance** removes an entry and its text entirely.

Publication, withdrawal, settings, component confirmations, incident updates and redactions, and maintenance changes write a transactional audit record. Audit entries contain the actor ID, action, revision and time, not old summary text. Owners/admins can load the latest 100 audit entries. Concurrent edits require the current revision; stale updates receive a conflict instead of overwriting a newer edit. Current history remains until explicitly redacted or the owning organization is deleted.

## Notifications

Page settings can opt into **published incident transition** notifications to enabled organization Slack, Teams, Discord and signed webhook destinations. This is off by default. Creating a visible incident or changing its incident state queues one event per enabled destination; another summary in the same state does not. Publishing an existing draft, changing component state, redacting history, and scheduling/cancelling maintenance do not send announcements.

There are no public email subscriptions or automatic scheduled-maintenance announcements in this slice. Existing personal email/in-app issue notifications remain separate.

Status messages use the notification delivery worker, encryption, retries and delivery history. Generic webhooks receive `event: "guardian.status"`, `test: false` and `issueId: null` with the approved incident title and transition summary. There is no internal issue payload. Queue insertion and page changes commit together. Before sending, the worker checks that the destination is enabled and the page is still published at the exact queued revision. A newer edit, redaction or unpublish cancels older queued status messages, prioritizing withdrawal over sending outdated summaries. Messages already accepted by a provider cannot be recalled; delivery remains at-least-once.

## Public-data isolation and caching

Private page documents and audit records use tenant-scoped row-level security. Public access reads only the separate `public_status_pages` table using a transaction-local exact-slug policy. No security-definer function or superuser runtime is required. Public responses serialize an explicit document schema and never the private page model, organization ID, actor ID, credentials or diagnostics. Text is rendered as text, not HTML.

Public HTML is dynamic and the JSON API returns `Cache-Control: no-store, max-age=0`; public pages are marked noindex. Unpublication and snapshot deletion commit atomically with the audit record. Do not add a CDN override that caches these routes. These controls cannot remove screenshots, third-party archives, previously sent notifications or copies already received by a browser.

## Deployment and verification

Apply migration `202609280004_status_pages`, regenerate Prisma, and deploy both web and worker. Existing notification encryption keys must remain unchanged. The migration adds the three status-page tables and an optional status-message payload on external deliveries.

Verification includes:

- Unit tests for hidden-component filtering, mixed-visibility history, strict serialization, stale evidence, maintenance boundaries/cancellation and outage precedence.
- Real PostgreSQL/pg-boss integration for default privacy, authorization, cross-tenant isolation, approved publication, concurrent edits, redaction, restricted-role public reads without private-table/write access, incident transition deduplication, accepted delivery through an injected no-network sender, and cancellation after withdrawal.
- Chromium desktop (1440×1000), tablet (768×1024) and mobile (390×844) creation, component selection, incident/maintenance entry, anonymous viewing, no-store headers, unpublication and overflow checks. Existing application browser checks also pass. Screenshots are under `docs/qa/2026-09-28/`.

Run `STATUS_PAGES_LIVE_TEST=1` with `.env` loaded against a migrated test database for `tests/status-pages/lifecycle.integration.test.ts`. GitHub CI now runs this integration and the notification-delivery integration after migrations, with an ephemeral test encryption key and no external provider messages. Browser QA uses disposable local organizations and removes them afterward.

Custom domains, per-client invitation/access lists, white-label branding, automatic monitor-to-component mapping and public subscriber notifications remain future extensions. Basic accessibility monitoring is the next approved roadmap phase. Billing remains paused.
