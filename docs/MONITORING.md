# Guardian — HTTP monitoring contract

The PRD's HTTP status and response-time requirement is implemented by the
worker-backed `UPTIME` monitor. It is deliberately separate from SSL and
broken-link checks while reusing the same tenant-scoped result pipeline.

## UPTIME result semantics

- HTTP `200–399` is recorded as `UP` (including redirects; redirects are not
  followed by the outbound security boundary).
- HTTP `400–599` is recorded as `DOWN` and creates a `monitor.http_status`
  finding with the returned status code in both the result and technical
  evidence.
- DNS, connection, TLS, timeout, malformed-response, and outbound-policy
  failures are recorded as `ERROR` with a `monitor.uptime` finding.
- `responseTimeMs` is the non-negative elapsed duration of the bounded HEAD
  request. The request is limited to 10 seconds and does not read a response
  body.

Every result persists `status`, `httpStatusCode` when an HTTP response exists,
`responseTimeMs`, and the finding evidence. The dashboard displays the HTTP
status and latency in recent outcomes; the response-time history uses the same
durable result data.

This is availability monitoring, not a complete performance benchmark. The
PRD's broader performance monitor remains a later adapter.

## Basic SEO v1

The worker-backed `SEO` monitor contract is documented separately in
[`SEO.md`](./SEO.md). It is a bounded verified-homepage scan; structured data,
duplicate-content analysis, and broader SEO Intelligence remain deferred.

## Basic Security v1

The worker-backed `SECURITY` monitor contract is documented in
[`SECURITY-MONITORING.md`](./SECURITY-MONITORING.md). It is a bounded header and
exposed-configuration hygiene check, not a complete cybersecurity assessment.

## Performance v1

The worker-backed `PERFORMANCE` monitor contract is documented in
[`PERFORMANCE.md`](./PERFORMANCE.md). It measures one bounded server response;
browser rendering and Core Web Vitals remain deferred.

## Critical lead forms v1

The worker-backed `FORM` monitor contract is documented in
[`FORM-MONITORING.md`](./FORM-MONITORING.md). It verifies a named,
server-rendered form and optionally a same-origin `HEAD` probe. It never submits
lead data; downstream delivery can only be proven by a separately approved
canary workflow.
