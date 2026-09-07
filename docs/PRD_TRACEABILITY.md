# Guardian PRD Traceability

**Canonical source:** [`PRD.md`](./PRD.md), transcribed from the supplied `Guardian_Master_PRD.pdf` (Version 2.0).  
**Reviewed:** 3 September 2026  
**Purpose:** Keep implementation decisions tied to explicit product requirements and prevent scope drift.

## Current alignment

| PRD capability                      | Current repository evidence                                                | Status                      | Next required work                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Authentication and organizations    | Local PostgreSQL auth adapter, organization membership, RBAC, tenant-scoped APIs | Implemented foundation | Verify production Compose bootstrap and end-to-end flows |
| Businesses and websites             | Website/business services and APIs                                         | Implemented foundation      | Add full onboarding/scan experience                                                    |
| Uptime and SSL monitoring           | Background worker, monitor configuration, results, issue creation          | Implemented for these types | Verify scheduled execution on the production host                                      |
| HTTP status and response time       | Uptime worker records HTTP status and response time                        | Partial                     | Define and test the separate HTTP monitoring contract                                  |
| Website scanning/free audit         | Verification endpoint exists                                               | Missing as PRD audit        | Build rate-limited public audit flow                                                   |
| Broken links                        | Monitor type is represented in the model/UI                                | Missing execution           | Implement a bounded, SSRF-safe link scanner                                            |
| Basic SEO                           | Monitor type is represented in the model/UI                                | Missing execution           | Implement title/meta/headings/canonical/robots/sitemap/indexability checks             |
| Basic security                      | SSL exists; broader checks are not implemented                             | Partial                     | Add scoped security-header and exposed-configuration checks; state limitations clearly |
| Critical lead forms                 | FORM monitor type exists in the model/UI                                   | Missing execution           | Design safe synthetic form testing and evidence capture                                |
| Issues and lifecycle                | Issue engine, severity/status, activity, deduplication fields              | Implemented foundation      | Ensure every monitor emits evidence, impact, confidence, and recommendations           |
| Digital Health Score                | PRD defines six weighted categories; schema comments say scores are staged | Missing                     | Add explainable score computation and component history                                |
| Recommendations and AI explanations | No complete grounded recommendation/AI layer                               | Missing                     | Implement only after reliable observations and issue evidence exist                    |
| Email and in-app alerts             | Notification services and SMTP adapter exist                               | Implemented foundation      | Verify provider configuration and delivery/retry behavior in production                |
| Background jobs                     | pg-boss plus private tenant-dispatch registry; worker scopes tenant reads  | Implemented foundation      | Confirm persistent worker hosting and apply the dispatch migration                     |
| Reporting                           | Queue analytics/export exists                                              | Partial                     | Add PRD daily/weekly/monthly report content                                            |
| Billing                             | No complete billing implementation                                         | Future phase                | Do not begin before MVP validation                                                     |
| Agency/white-label                  | Not yet implemented                                                        | Future phase                | Begin only after MVP testing and product validation                                    |

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
