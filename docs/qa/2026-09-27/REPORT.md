# Visual QA: Chromium baseline completed

The unavailable browser connector no longer blocks visual QA. Playwright runs Chromium directly against the current local development app at `http://localhost:3001`.

## Verified scope

All three browser tests passed: desktop 1440x1000, tablet 768x1024, mobile 390x844. Each visited 17 implemented routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/audit`, `/dashboard`, `/health`, `/seo`, `/security`, `/revenue`, `/settings/alerts`, `/onboarding`, `/onboarding/verify`, `/briefings`, `/dashboard/executive`, and `/billing`.

- No horizontal page overflow on those routes or the expanded DNS panel after the fix.
- No uncaught browser JavaScript errors during the tested flows.
- Actual authenticated baseline acceptance, changed/unchanged evidence, disabled acceptance on incomplete observations, and first-check empty state.
- Incident detail disclosure, notification preference persistence, SLA save feedback, and keyboard focus on the skip link.
- Monitoring loading state and a deliberately injected HTTP 503 failure state.
- Rendered screenshot review of the dark surfaces, purple actions, shield branding, type hierarchy, form layouts, responsive cards and DNS comparisons against the existing Stitch design direction. Mock financial/AI/network telemetry from the references remains intentionally absent.

The suite uses a disposable database tenant and session. It does not use the owner's account, schedule monitors, submit public audits, or send email. Fixtures are removed after the run. This is functional browser coverage plus screenshot inspection, not a pixel-diff regression baseline.

## Fixes found through browser QA

1. A long member email widened the incident assignee dropdown beyond the mobile viewport. Constrained the label and select to their available width. The full three-viewport rerun passed.
2. The signup introduction was squeezed into a narrow column at tablet width. Use the single-column form below 900px. A separate 768x1024 Chromium screenshot and overflow check passed after this change.
3. Corrected the singular DNS label to “1 record type changed.”

Representative screenshots:

- [Desktop DNS evidence](dns-desktop.png)
- [Mobile dashboard after overflow fix](dashboard-mobile.png)
- [Mobile notification settings](alerts-mobile.png)
- [Tablet signup after layout fix](signup-tablet.png)

The full run produced 72 screenshots under ignored `test-results/`; `playwright-report/index.html` contains the local run report. Fixed navigation remains viewport-positioned in full-page captures, so it can appear midway down a tall screenshot. The screenshots include the development-mode Next.js indicator.

## Reproduce

Use the local test database with current migrations and `.env`. The app and tests must use the same database. The suite writes disposable fixtures and therefore needs fixture-creation privileges. Do not point this workflow at a production database.

```powershell
npm ci
npx playwright install chromium
npm run dev -- --port 3001
```

In a second terminal:

```powershell
npm run test:visual
npx playwright show-report
```

`QA_BASE_URL` can select another local HTTP port. The configuration rejects non-local app URLs. Generated reports and screenshots are ignored by Git, ESLint and Prettier; only selected evidence is checked in.

## Limits

This closes the deferred Chromium visual QA baseline for implemented screens. It is not a Firefox/WebKit, real-device, screen-reader, contrast-conformance, or full business-workflow audit. Authentication forms were visually reviewed; account registration/reset delivery was not exercised. Current monitoring category views were reviewed with insufficient-data states, not every possible monitoring result. Billing is still a placeholder and paused; SMTP sender quota remains a separate blocker. Docker production images were not rebuilt for this QA pass. CI must pass on the new PR commit before merging.

Supporting checks: nine affected unit tests, TypeScript, targeted ESLint and formatting passed.
