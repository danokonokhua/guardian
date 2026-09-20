# Free Audit v1 technical validation — 13 September 2026

## Scope

Guardian's bounded public audit was exercised against ten authorized public
websites using the same `runFreeAudit` service as `POST /api/audit`. The run
covered availability, server response time, Basic SEO v1, and Basic Security
v1. Lead generation and reputation remain explicitly outside this snapshot,
so every score is labelled `PARTIAL` with its measured coverage.

## Defects found and corrected

1. The operator CLI now loads the server-only bootstrap before importing the
   audit service.
2. The pinned DNS callback resolver supports Node's `all: true` lookup mode and
   prefers a safe IPv4 address on dual-stack sites while continuing to reject
   any hostname with a non-public answer.
3. The bounded homepage body cap increased from 256 KiB to 512 KiB after two
   normal sites measured approximately 516 KB and 445 KB. Fixed security
   probes remain capped at 8 KiB.
4. Top-level audit adapters now run sequentially to avoid creating false
   timeouts on resource-constrained shared-hosting targets.
5. `audit:validate -- --detailed` now exposes bounded finding evidence for
   operator review.

## Final technical run

| Website                       | Score | Coverage | Critical | Warnings | Primary evidence                                          |
| ----------------------------- | ----: | -------: | -------: | -------: | --------------------------------------------------------- |
| okapiccf.com                  |    62 |      65% |        0 |        2 | response above 3 seconds; missing security headers        |
| ritssbeauty.com               |    62 |      65% |        0 |        2 | no non-empty H1; security-header gaps                     |
| hmcng.com                     |    62 |      65% |        0 |        2 | no non-empty H1; security-header gaps                     |
| gabofarms.com                 |    62 |      65% |        0 |        2 | SEO metadata/structure gaps; security-header gaps         |
| gabogreenenergysolutions.com  |    62 |      65% |        0 |        2 | SEO metadata/structure gaps; security-header gaps         |
| mvpterminallingllc.com        |    62 |      65% |        0 |        2 | no meta description; security-header gaps                 |
| fareharbor.com                |    62 |      65% |        0 |        2 | sitemap redirects; CSP/frame-protection gaps              |
| danwebdevelopment.com         |    62 |      65% |        0 |        2 | SEO metadata/structure/sitemap gaps; security-header gaps |
| nenafrika.com                 |    60 |      25% |        1 |        2 | intermittent HTTPS timeouts; partial SEO/security result  |
| africancouncilofoptometry.org |    62 |      65% |        0 |        2 | SEO metadata/structure/sitemap gaps; security-header gaps |

These scores are a single bounded snapshot. They are not a complete security
assessment, browser/Core Web Vitals result, or proof of a performance trend.

## False-positive and usefulness review

- Initial dual-stack transport errors, self-induced concurrent-request
  timeouts, and 256 KiB body-limit failures were scanner defects and have been
  removed.
- Missing title/description/H1/canonical/sitemap findings are directly
  actionable and map to the PRD's Basic SEO scope.
- Missing HSTS, CSP, nosniff, and frame-protection headers are directly
  observable hygiene findings, but must not be described as a complete
  cybersecurity assessment.
- A performance result close to the 3-second threshold must be confirmed by
  scheduled checks before being presented as a trend.
- A failed fixed-path security probe is incomplete evidence, not proof that a
  sensitive resource is exposed. Only a matching bounded response signature
  may be described as an exposure.
- Sitemap redirects are reported because the v1 scanner deliberately does not
  follow redirects. This is useful configuration evidence but should not be
  described as proof that no sitemap exists.

## Gate decision

The technical free-audit implementation has passed representative execution
on ten websites after the corrections above. The broader PRD validation gate
is still open because no business-owner feedback or prevented/resolved problem
metric has been collected. Billing, agency/white-label expansion, and later AI
COO capabilities remain blocked by that product-validation requirement.
