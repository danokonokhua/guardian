# Basic accessibility monitoring

Implemented 28 September 2026. In **Dashboard > Monitoring**, select a verified website and **Basic accessibility (HTML checks)**. The default interval is daily; supported intervals are 60–1,440 minutes. Existing pause, resume and run-now controls apply.

## What is checked

The monitor requests the verified website's configured URL once and analyzes its server-delivered HTML. It does not crawl links, execute scripts, fetch CSS/images, log in, submit forms or launch a browser. Evidence identifies the page, scan time, scope and tool version: `Guardian HTML accessibility 1.0.0 / parse5 8.0.1`.

| Rule              | Finding                                                              | Suggested correction                                               |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Document language | Missing or blank `html lang`                                         | Declare the page's primary language.                               |
| Document title    | Missing or blank title in the document head                          | Provide a meaningful page title.                                   |
| Image alternative | No text alternative identified for a non-decorative image            | Add meaningful alt text, or an empty alt attribute for decoration. |
| Form label        | No label/name identified for an input, select or textarea            | Associate a native label or an appropriate ARIA name.              |
| Control name      | Empty button, link, image input or supported custom button/link name | Add meaningful visible text or an appropriate accessible name.     |
| Empty heading     | Heading has no identified text/name                                  | Add meaningful heading content or remove the empty element.        |

Names recognize common explicit/wrapping labels, `aria-label`, `aria-labelledby` references, text, image alternatives, title fallback and browser-default submit/reset labels. Placeholder and ordinary input values are not treated as labels. Name checks are bounded heuristics rather than a complete implementation of the browser accessibility tree.

Empty `alt=""` and non-focusable presentation/none images are treated as decorative. Hidden inputs, excluded script/style/template/noscript content, `hidden`, `inert`, `aria-hidden="true"`, and explicit inline display/visibility hiding are excluded, including descendants. Referenced hidden text can supply an ARIA name. External stylesheets and computed visibility cannot be assessed. A decorative image alone does not provide an enclosing link with a useful name. See [W3C decorative-image guidance](https://www.w3.org/WAI/tutorials/images/decorative/) and [form labeling guidance](https://www.w3.org/WAI/tutorials/forms/labels/).

## Results and incidents

The dashboard shows per-rule counts, severity, suggested fixes and up to five example source-line locations per rule. It does not persist raw page HTML, input values, attribute values or query strings in evidence. Locations refer to the fetched HTML, not a JavaScript-modified DOM. Full observations are stored as tenant-scoped monitoring history, and the dashboard displays the latest observation.

Complete scans create or update one incident per rule and page. Repeated scans deduplicate these incidents. A later complete scan resolves rules no longer detected; recurrence reopens the corresponding incident. Existing SLA escalation and configured notification preferences/destinations apply. No separate accessibility email channel or health-score weight is introduced.

An unavailable or incomplete scan records `UNKNOWN` evidence and an `ERROR` monitoring result. It preserves the last complete evidence and does not resolve existing incidents. The UI labels retained evidence as stale. Paused or unverified websites do not accept in-flight results, and older/equal observations cannot overwrite newer results. Client updates cannot replace persisted accessibility evidence.

“No findings in these HTML checks” is deliberately limited to the scanned response and supported rules. It is not a claim that the website is accessible, compliant, or certified. Manual keyboard, assistive-technology, contrast, focus-order, dynamic interaction and content-quality review remain necessary. See [W3C accessible-name guidance](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/).

## Request and resource limits

- One public-address request through Guardian's DNS-pinned outbound transport; redirects are not followed. Private, loopback and metadata targets are blocked.
- Ten-second overall request deadline with socket cancellation. A DNS lookup completing after cancellation cannot open a socket.
- Maximum 256 KiB HTML response, 10,000 elements and 100 nesting levels. The analysis loop also has a one-second budget; the input byte cap bounds parsing work before that loop.
- Only declared `text/html` responses with UTF-8/ASCII or no explicit charset are analyzed. Guardian requests identity encoding; unsupported compressed or other declared character encodings produce unknown evidence.
- Script execution, computed CSS, shadow DOM, iframes, multi-page crawling and rendered-browser audits are outside this slice. A future rendered-browser scanner must run in an isolated, resource-limited worker as required by the PRD.

These limits favor an explicit unknown result over treating a partial response as a successful audit. For a redirecting URL, configure the verified canonical destination rather than assuming the redirect was scanned. Client-rendered applications may return only a shell, so even a complete HTML scan can cover little of their visible interface.

## Deployment and verification

Apply migration `202609280005_accessibility`, regenerate Prisma, install locked dependencies and deploy both web and worker. `parse5` 8.0.1 is now an explicit production dependency; no browser binary is required by this monitor. The existing scheduler and monitor queue dispatch the new `ACCESSIBILITY` type.

Unit fixtures cover supported findings, decorative/hidden content, native and ARIA labels, SVG/document-title separation, empty functional controls, malformed HTML, resource caps, unsupported responses, and request cancellation. Real PostgreSQL/pg-boss integration covers concurrency, evidence persistence, tenant isolation, read-only configuration, pause/verification checks, deduplication, SLA routing, unknown retention, resolution/reopening and the actual registered adapter. Its page transport is controlled; it sends no provider messages.

Run `ACCESSIBILITY_LIVE_TEST=1` with `.env` loaded for `tests/jobs/accessibility.integration.test.ts`. This gate also runs in GitHub CI after database migrations. Chromium desktop/tablet/mobile QA covers findings, source locations, retained stale evidence and the existing application/status-page flows. Screenshots are retained under `docs/qa/2026-09-28/`.

This completes the initial six-part monitoring expansion with the scope above. Billing remains paused. The next product milestone should be the PRD's real-business MVP validation and prioritization of the documented extensions, rather than claiming full accessibility auditing or the agency platform is complete.
