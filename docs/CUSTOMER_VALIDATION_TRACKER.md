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
| 1   | okapiccf.com                  | Slow response snapshot; security-header gaps                                          | Yes                    | Completed    | No           | Unknown           |
| 2   | ritssbeauty.com               | No non-empty H1; HSTS/CSP gaps (score 62; 2 warnings)                                 | Yes                    | Completed    | No           | Unknown           |
| 3   | hmcng.com                     | No non-empty H1; HSTS/CSP/nosniff/frame-protection gaps (score 62; 2 warnings)        | Yes                    | Completed    | No           | Unknown           |
| 4   | gabofarms.com                 | SEO metadata/structure and security-header gaps                                       | Yes                    | Completed    | Yes (Dev)    | Unknown (Pending) |
| 5   | gabogreenenergysolutions.com  | SEO metadata/structure and security-header gaps                                       | Pending                | Pending      | Pending      | Pending           |
| 6   | mvpterminallingllc.com        | No meta description; HSTS/CSP/nosniff/frame-protection gaps (score 62; 2 warnings)    | Pending                | Pending      | Pending      | Pending           |
| 7   | fareharbor.com                | Sitemap HTTP 301; CSP/frame-protection gaps; incomplete probes (score 62; 2 warnings) | Pending                | Pending      | Pending      | Pending           |
| 8   | danwebdevelopment.com         | Missing meta/H1/canonical; sitemap 404; header gaps (score 62; 2 warnings)            | Yes                    | Completed    | No (Planned) | No                |
| 9   | nenafrika.com                 | Slow response 5910 ms; security-header gaps (score 62; 2 warnings)                    | Pending                | Pending      | Pending      | Pending           |
| 10  | africancouncilofoptometry.org | Slow response 3304 ms; security-header gaps (score 62; 2 warnings)                    | Yes                    | Completed    | No           | Unknown           |

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
| Businesses with completed review      |       6 | At least 5                               |
| Findings confirmed accurate/partly    |       4 | Measure; no threshold invented by PRD    |
| Owners who took an action             |       1 | Measure                                  |
| Problems confirmed prevented/resolved |       0 | Evidence required for every claimed case |

Validation summary (September 2026):
- 6 of 10 portfolio businesses completed formal validation reviews (threshold of ≥ 5 satisfied).
- 5 of 6 reviewers (83%) expressed clear intent to continue using Guardian ("Yes").
- Average usefulness score: 3.83 / 5.0 (three 5/5, two 3/5, one 2/5).
- 4 of 6 confirmed findings as accurate or partly accurate; 2 were unsure due to CDN/hosting layering.
- 1 owner immediately assigned findings to their developer for remediation (Gabo Farms).
- Key product finding: Customers strongly requested direct remediation / step-by-step resolution guides ("How does it get solved / fix it for me").

## Technical rerun log

| Date (UTC) | Website       | Result                                    | Interpretation                                                             |
| ---------- | ------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| 2026-09-13 | nenafrika.com | HTTP 200; 3588 ms; score 62; coverage 65% | Previous timeout not reproduced; repeat before calling performance a trend |
