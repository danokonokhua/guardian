# Customer validation tracker

**Opened:** 13 September 2026
**Protocol:** [`CUSTOMER_VALIDATION.md`](./CUSTOMER_VALIDATION.md)
**Technical evidence:**
[`AUDIT_VALIDATION_20260913.md`](./AUDIT_VALIDATION_20260913.md)

This tracker separates Guardian's technical observations from customer-confirmed
outcomes. `Pending` means the owner or authorized operator has not yet supplied
the evidence. Do not convert a technical finding into a business-outcome claim
without confirmation.

## Portfolio status

| #   | Website                       | Technical snapshot                                                                    | Permission reconfirmed | Owner review | Action taken | Outcome confirmed |
| --- | ----------------------------- | ------------------------------------------------------------------------------------- | ---------------------- | ------------ | ------------ | ----------------- |
| 1   | okapiccf.com                  | Slow response snapshot; security-header gaps                                          | Pending                | Pending      | Pending      | Pending           |
| 2   | ritssbeauty.com               | No non-empty H1; HSTS/CSP gaps (score 62; 2 warnings)                                 | Pending                | Pending      | Pending      | Pending           |
| 3   | hmcng.com                     | No non-empty H1; HSTS/CSP/nosniff/frame-protection gaps (score 62; 2 warnings)        | Pending                | Pending      | Pending      | Pending           |
| 4   | gabofarms.com                 | SEO metadata/structure and security-header gaps                                       | Pending                | Pending      | Pending      | Pending           |
| 5   | gabogreenenergysolutions.com  | SEO metadata/structure and security-header gaps                                       | Pending                | Pending      | Pending      | Pending           |
| 6   | mvpterminallingllc.com        | No meta description; HSTS/CSP/nosniff/frame-protection gaps (score 62; 2 warnings)    | Pending                | Pending      | Pending      | Pending           |
| 7   | fareharbor.com                | Sitemap HTTP 301; CSP/frame-protection gaps; incomplete probes (score 62; 2 warnings) | Pending                | Pending      | Pending      | Pending           |
| 8   | danwebdevelopment.com         | Missing meta/H1/canonical; sitemap 404; header gaps (score 62; 2 warnings)            | Pending                | Pending      | Pending      | Pending           |
| 9   | nenafrika.com                 | Slow response 5910 ms; security-header gaps (score 62; 2 warnings)                    | Pending                | Pending      | Pending      | Pending           |
| 10  | africancouncilofoptometry.org | Slow response 3304 ms; security-header gaps (score 62; 2 warnings)                    | Pending                | Pending      | Pending      | Pending           |

## First interview record

Start with any owner who has explicitly agreed to review Guardian. Do not infer
that technical authorization also grants permission to publish their feedback.

```text
Business identifier:
Website:
Owner/operator permission reconfirmed: yes / no
Interview date (UTC):

Finding 1:
Accurate: yes / partly / no
Understandable: yes / no
Business impact credible: yes / no
Action taken (or none):
Problem prevented/resolved: yes / no / unknown
Outcome evidence:
Estimated time/cost/opportunity impact: amount / unknown

Finding 2:
Accurate: yes / partly / no
Understandable: yes / no
Business impact credible: yes / no
Action taken (or none):
Problem prevented/resolved: yes / no / unknown
Outcome evidence:
Estimated time/cost/opportunity impact: amount / unknown

Overall usefulness: 1 / 2 / 3 / 4 / 5
Would continue using Guardian: yes / no / unsure
Most valuable result:
Most important missing capability:
Permission to quote feedback publicly: yes / no
```

## Outreach message

> We are validating Guardian, a digital business monitoring platform. With your
> permission, I would like to show you a short audit of your website and ask
> seven questions about whether the findings are accurate, understandable, and
> useful. The review should take approximately 15 minutes. This is a bounded
> website-health audit, not a complete cybersecurity assessment, and nothing
> will be changed on your website. May we conduct and record this validation
> session?

## Gate totals

| Metric                                | Current | Required for review                      |
| ------------------------------------- | ------: | ---------------------------------------- |
| Businesses with completed review      |       0 | At least 5                               |
| Findings confirmed accurate/partly    |       0 | Measure; no threshold invented by PRD    |
| Owners who took an action             |       0 | Measure                                  |
| Problems confirmed prevented/resolved |       0 | Evidence required for every claimed case |

The product owner will make the phase-gate decision from these results. The PRD
requires 5–10 real-business tests but does not define numerical accuracy or
conversion thresholds, so this tracker does not invent them.

## Technical rerun log

| Date (UTC) | Website       | Result                                    | Interpretation                                                             |
| ---------- | ------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| 2026-09-13 | nenafrika.com | HTTP 200; 3588 ms; score 62; coverage 65% | Previous timeout not reproduced; repeat before calling performance a trend |
