# Guardian — Basic Security v1 monitoring contract

Basic Security v1 is a bounded website-hygiene check for one verified website. It
is not a penetration test, vulnerability scanner, or complete cybersecurity service.
Every request uses the shared SSRF-safe outbound boundary and does not follow
redirects.

## Checks

The worker makes one bounded `GET` request to the verified homepage and a fixed,
same-origin set of six `GET` probes (`/.env`, `/.env.production`, `/.git/HEAD`,
`/wp-config.php`, `/phpinfo.php`, and `/server-status`). Response bodies are used
only in memory to match high-confidence signatures and are never stored in issue
evidence, logs, or API responses. A `2xx` probe is only reported as exposed when
its body matches the path-specific signature; ordinary custom `404` pages are not
reported.

For HTTPS pages the homepage must send HSTS with a max-age of at least six months.
The worker also checks for an enforced Content-Security-Policy (report-only does
not count), `X-Content-Type-Options: nosniff`, and clickjacking protection through
`X-Frame-Options` or CSP `frame-ancestors`. HTTP pages fail the HTTPS check.

## Outcomes and evidence

- `UP`: all bounded checks pass and no exposure is confirmed.
- `DOWN`: the page is reachable but a required header or high-confidence exposure
  check fails.
- `ERROR`: the homepage or a bounded probe could not be evaluated reliably.

The result stores only flat, bounded metadata: check names, status codes, header
presence/validation flags, probe identifiers, and counts. Header values are not
persisted. The aggregate issue rule is
`monitor.security`; confirmed configuration exposure is raised at higher urgency
than a missing hygiene header.

Outdated WordPress detection, suspicious-change detection, dependency scanning,
authentication testing, exploit testing, and full OWASP assessment are deliberately
deferred. Those capabilities require separate contracts and must not be inferred
from this monitor.
