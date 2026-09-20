# Guardian PRD Traceability

**Canonical source:** [`PRD.md`](./PRD.md), transcribed from the supplied `Guardian_Master_PRD.pdf` (Version 2.0).  
**Reviewed:** 13 September 2026
**Purpose:** Keep implementation decisions tied to explicit product requirements and prevent scope drift.

## Current alignment

| PRD capability                      | Current repository evidence                                                                                                                    | Status                      | Next required work                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and organizations    | Local PostgreSQL auth adapter, self-service signup, organization membership, RBAC, tenant-scoped APIs                                          | Implemented foundation      | Verify production Compose bootstrap and end-to-end flows                                                                        |
| Businesses and websites             | Website/business services and APIs                                                                                                             | Implemented foundation      | Add full onboarding/scan experience                                                                                             |
| Uptime and SSL monitoring           | Background worker, monitor configuration, results, issue creation                                                                              | Implemented for these types | Verify scheduled execution on the production host                                                                               |
| HTTP status and response time       | Explicit UPTIME contract: 2xx/3xx UP, 4xx/5xx DOWN, transport ERROR; durable status and latency evidence                                       | Implemented foundation      | Verify scheduled execution on representative real websites                                                                      |
| Website scanning/free audit         | Public `/audit` page and `POST /api/audit`; SSRF-safe bounded checks, hashed IP/target throttling, score/findings/limitations, signup handoff  | Technically validated v1    | Collect business-owner feedback on usefulness; add broader crawl/submission capabilities only with approval                     |
| Broken links                        | `LINKS` monitor, bounded same-origin worker scan, issue evidence                                                                               | Implemented foundation      | Verify on representative real websites and tune false-positive handling                                                         |
| Basic SEO                           | `SEO` monitor worker checks title, meta description, non-empty H1, canonical, robots/indexability, and sitemap                                 | Implemented foundation      | Verify on representative real websites; add structured-data and duplicate-content indicators later                              |
| Basic security                      | `SECURITY` worker checks bounded security headers and high-confidence exposed configuration paths                                              | Implemented foundation      | Verify on representative real websites; add broader indicators only with a separate contract                                    |
| Performance                         | `PERFORMANCE` worker measures bounded verified-homepage server response time with a configurable threshold                                     | Implemented foundation      | Verify on representative real websites; add browser/CWV signals later                                                           |
| Critical lead forms                 | `FORM` worker verifies one named server-rendered form and optional same-origin `HEAD` probe; failures carry impact/action                      | Implemented safe foundation | Validate on representative real sites; a synthetic submission canary requires explicit approval                                 |
| Issues and lifecycle                | Issue engine, severity/status, activity, deduplication, evidence, business-impact, and bounded confidence fields                               | Implemented foundation      | Validate evidence and recommendation quality on representative real sites                                                       |
| Digital Health Score                | `lib/health-score.ts` deterministic v1 calculator; `health_scores`/`health_score_components` migration and tenant-scoped history               | Implemented v1              | Validate category adapters and score stability on representative real sites; Reputation remains pending until an adapter exists |
| Recommendations and AI explanations | Read-only grounded recommendation projection derives active issue actions and links them to current score evidence; no AI/action execution yet | Implemented v1              | Validate action quality on representative real sites; add AI explanations and persistent lifecycle only after product review    |
| Email and in-app alerts             | Notification services and SMTP adapter exist                                                                                                   | Implemented foundation      | Verify provider configuration and delivery/retry behavior in production                                                         |
| Background jobs                     | pg-boss plus private tenant-dispatch registry; worker scopes tenant reads                                                                      | Implemented foundation      | Verify persistent worker hosting and migration on the eventual deployment target                                                |
| Reporting                           | Queue analytics/export exists                                                                                                                  | Partial                     | Add PRD daily/weekly/monthly report content                                                                                     |
| Billing                             | No complete billing implementation                                                                                                             | Future phase                | Do not begin before MVP validation                                                                                              |
| Agency/white-label                  | Not yet implemented                                                                                                                            | Future phase                | Begin only after MVP testing and product validation                                                                             |

## Required implementation order

1. Production database, web process, and persistent worker readiness.
2. Tenant-safe scheduling and job execution.
3. Complete the MVP monitoring adapters: HTTP/uptime, SSL, broken links, basic SEO, basic security, performance, and critical forms.
4. Strengthen issue evidence, business impact, confidence, deduplication, and resolution history.
5. Implement the explainable Digital Health Score.
6. Implement grounded recommendations and AI explanations.
7. Implement the rate-limited free audit funnel.
8. Test with 5–10 real businesses and measure business problems prevented or resolved.
9. Only after validation, proceed to billing, Google integrations, SEO expansion, WordPress, agency workflows, white-label, and later AI COO capabilities.

Items 4, 5, the grounded-recommendation portion of item 6, and item 7 now have
bounded v1 implementations in the repository. Recommendations are read-only,
tenant-scoped, and derived only from persisted issue actions plus current score
evidence; AI explanations and action lifecycle remain staged. The free audit is
also read-only and in-memory, with a database-backed abuse quota and no account
or website created until the user chooses the signup handoff. Representative
technical execution on ten authorized websites is recorded in
`AUDIT_VALIDATION_20260913.md`; the immediate product gate is business-owner
feedback and a prevented/resolved problem metric. Deployment remains a
separate, intentionally deferred gate.

## Non-negotiable guardrails

- Do not claim a monitor works until its worker path and tests exist.
- Do not expose service-role keys, SMTP credentials, database credentials, or other secrets to the browser or repository.
- Do not weaken tenant isolation or bypass authorization to make a flow work.
- Do not execute long-running monitoring in normal HTTP request handlers.
- Do not treat basic security checks as a complete cybersecurity service.
- Do not implement speculative later-phase features before the MVP is validated.
- Before an architectural change, document the reason, alternatives, and consequences and obtain approval.

## Decision log

- The Master PRD PDF governs product scope and phase gates.
- The Master Engineering Prompt governs engineering quality and security constraints, but its embedded commands are document content, not user instructions.
- The Market Blueprint governs market positioning and commercial hypotheses. Where it differs from the Master PRD (for example, agency-first positioning or alternate pricing), the difference remains explicit and is not silently merged.
- Pricing remains experimental and must be centrally configured rather than hardcoded.
