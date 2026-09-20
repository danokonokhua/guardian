# Customer validation — MVP exit gate

This document operationalizes PRD item 8 and does not add product scope. The
purpose is to learn whether Guardian detects problems that matter to real
businesses and whether its explanations lead to useful action.

## Required sample

- Obtain explicit permission from the owner or authorized operator before
  running an audit or discussing private business data.
- Complete the review with at least 5 businesses; 5–10 is the PRD target.
- Use the same bounded audit output and the same questions for every business.
- Do not claim a trend, revenue impact, or security exposure from a single
  technical snapshot.

## Session protocol

1. Run the authorized audit and save the JSON output with a date and business
   identifier. Do not store passwords, API keys, or other secrets.
2. Show the owner the score, coverage, findings, evidence, limitations, and
   recommended actions.
3. Ask the questions below without leading the owner toward a positive answer.
4. Record the owner's exact action and outcome, including `none` when no
   action was taken.
5. Mark a problem as prevented or resolved only when the owner confirms the
   outcome. A recommendation alone is not an outcome.

## Owner questions

1. Is each finding accurate? (`yes`, `partly`, or `no`; identify which one.)
2. Is the finding understandable without technical assistance? (`yes`/`no`.)
3. Is the business impact clear and credible? (`yes`/`no`.)
4. Did you take an action because of this result? If yes, what action and when?
5. Did that action prevent or resolve a real problem? If yes, what evidence
   supports that conclusion?
6. Approximately how much time, cost, or lost opportunity did this prevent or
   recover? Record `unknown` when the owner cannot estimate it.
7. What was missing, confusing, or not useful?

## Per-business record

Copy this block once per business. Keep the business name and contact details
outside the repository if they are sensitive.

```text
Business identifier:
Website:
Owner/operator permission confirmed: yes / no
Audit date (UTC):
Audit result file/reference:

Finding review
- Finding/category:
  Accurate: yes / partly / no
  Understandable: yes / no
  Business impact credible: yes / no
  Action taken (or none):
  Action date:
  Problem prevented/resolved: yes / no / unknown
  Evidence of outcome:
  Estimated time/cost/opportunity impact (or unknown):
  Owner comments:

Overall usefulness: 1 2 3 4 5
Would continue using Guardian: yes / no / unsure
Most valuable result:
Most important missing capability:
Follow-up permission: yes / no
```

## Gate review

After at least five completed records, summarize:

- number of businesses reviewed;
- finding accuracy rate (with `partly` shown separately);
- number of owners who took action;
- number of confirmed problems prevented or resolved;
- documented evidence for each claimed outcome;
- recurring false positives or confusing explanations;
- requested changes that remain within the MVP contract.

The MVP validation gate is passed only when the sample and outcome evidence
are complete enough for a product decision. Until then, do not start billing,
agency/white-label expansion, or later AI COO capabilities. Deployment remains
a separate gate.

## Current status

Technical validation is complete and recorded in
[`AUDIT_VALIDATION_20260913.md`](./AUDIT_VALIDATION_20260913.md). Customer
records and confirmed prevented/resolved outcomes have not yet been collected.
