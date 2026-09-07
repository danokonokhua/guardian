# Guardian — Engineering Specification

**Source:** `Guardian_Master_Engineering_Prompt.pdf` supplied by the project owner.  
**Role:** Engineering and security standard subordinate to [`PRD.md`](./PRD.md).  
**Reviewed:** 3 September 2026

This file records the engineering constraints that must accompany product work. It does not change product scope or authorize implementation by itself.

## Architecture principles

- Secure, scalable, multi-tenant SaaS.
- Business impact over technical noise.
- Evidence before recommendations.
- Prioritize rather than overwhelm.
- Automate repetitive work, but require human approval for risky actions.
- Security and privacy by design.
- Strict tenant isolation by default.
- Modular, API-first, independently testable features.
- Do not build speculative or fake production functionality.

## Tenant and security requirements

- Organizations must be strictly isolated.
- Authorization is based on authenticated identity, organization membership, and role.
- Use secure authentication, RBAC, validation, output encoding, secure cookies, rate limiting, security headers, encryption in transit, encrypted secrets, audit logs, webhook verification, least privilege, backups, and OWASP-aligned controls.
- Never hardcode secrets or pricing.
- Never bypass authentication or weaken tenant isolation.
- Never store plaintext credentials.

## Monitoring and job requirements

Monitoring supports uptime, HTTP status, SSL and expiry, DNS, redirects, response time, critical pages, broken links, availability, content changes, JavaScript errors, API failures, performance, and Core Web Vitals as capabilities are implemented.

Long-running monitoring must run through background workers, not normal request handlers. Jobs require retry, backoff, timeout, dead-letter handling, idempotency, and structured logging.

## Intelligence and action requirements

The trusted flow is:

`Data → Monitoring → Rules → Structured Context → AI → Recommendation → Risk Analysis → Human Approval → Action → Verification`

AI must not be the source of truth or invent monitoring results. Outputs should be traceable to source data. High-risk actions require explicit authorization and audit logs.

## Testing requirements

Maintain unit, integration, API, authorization, tenant-isolation, background-job, monitoring, AI-contract, security, and end-to-end tests. Critical flows must be automated. Do not disable tests to make builds pass and do not claim completion without verification.

## Development workflow

For each implementation task:

1. Explain the plan.
2. Identify affected files.
3. Implement only the approved scope.
4. Run tests, linting, and type checking.
5. Fix errors and verify manually where appropriate.
6. Update documentation and `PROJECT_STATE.md`.
7. Identify the next task.

Do not silently change architecture. If an architectural change is required, explain why, alternatives, and consequences, then obtain approval before implementation.
