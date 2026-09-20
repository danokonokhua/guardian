# Guardian — Basic SEO v1 monitoring contract

Basic SEO v1 implements the first bounded SEO adapter described by the PRD. It is a
worker-backed `SEO` monitor for one verified website homepage; it is not the later
SEO Intelligence product.

## Scope and request budget

- The monitor inspects the configured, verified homepage only. It does not crawl the
  site or execute JavaScript.
- It makes at most three outbound requests: the homepage, same-origin `/robots.txt`,
  and one same-origin sitemap URL.
- Every request uses the shared SSRF-safe outbound boundary, a 10-second timeout, and
  a response-body limit. Redirects are not followed.
- An external `Sitemap:` directive is ignored. The fallback sitemap is
  `/<sitemap.xml>` on the monitored origin.

## Checks

The adapter records a bounded aggregate `monitor.seo` finding at `MEDIUM` severity
when one or more checks fail:

- non-empty `<title>`;
- non-empty `meta[name="description"]`;
- at least one non-empty `<h1>`;
- a canonical link with an HTTP(S) URL and no embedded credentials;
- indexability: `robots`/`googlebot` meta directives and an `X-Robots-Tag` `noindex`
  directive are detected;
- a `User-agent: *` robots rule that disallows the monitored path is detected;
- the sitemap responds successfully and has a URL-set or sitemap-index XML root marker.

A missing `robots.txt` (`404` or `410`) is treated as the default crawl policy. Other
robots failures are reported. A missing or malformed sitemap is reported.

## Outcomes and evidence

- `UP`: homepage and auxiliary checks completed with no failures.
- `DOWN`: the homepage is reachable but one or more SEO checks fail, or an auxiliary
  robots/sitemap response is unusable.
- `ERROR`: the homepage could not be fetched/read, is unsafe, or returned a redirect.

Results retain status, HTTP status, elapsed time, check counts, failed check names,
bounded metadata lengths, indexability, robots/sitemap statuses, and the selected
sitemap URL. Full HTML and response bodies are never stored.

## Deliberate limits

Structured-data validation, duplicate-content indicators, page discovery, Search
Console/ranking signals, and broader SEO Intelligence are deferred follow-up work in
accordance with the PRD phase order. Broken-link detection remains a separate `LINKS`
monitor. The HTML inspection is intentionally a bounded server-rendered-document
heuristic, not a complete crawler or SEO audit.
