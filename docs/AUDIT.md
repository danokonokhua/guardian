# Free audit

Guardian's public free-audit funnel is available at `/audit` and
`POST /api/audit`.

The v1 contract accepts one public `http(s)` URL and performs four bounded
server-side checks in memory:

- availability/HTTP status;
- server response time;
- basic SEO metadata, robots, and sitemap;
- basic security headers and fixed exposed-configuration probes.

The result includes the explainable Digital Health Score projection, measured
coverage, critical findings, warnings, limitations, and a `Create an account`
handoff. Audit results are not persisted and no monitor, business, or
organization is created until signup.

## Abuse controls

The endpoint resolves only SSRF-safe public targets, rejects embedded
credentials, bounds each upstream response, does not follow redirects, and
never submits forms. Requests are limited to three attempts per five-minute
window for both a hashed source bucket and a hashed source/target bucket. Raw
IP addresses and URLs are never stored in the throttle table.

In production, configure `TRUSTED_PROXY=true` and `TRUSTED_PROXY_TOKEN` only
when a reverse proxy sanitizes and authenticates the forwarding headers. When
that trust boundary is not configured, the server deliberately treats direct
traffic as one shared source to avoid trusting spoofable client headers.

The free audit is a lead-generation and triage experience, not a complete
cybersecurity assessment, a full crawl, a browser/Core Web Vitals test, or a
synthetic lead submission.

## Representative validation

After obtaining permission from each business owner, validate up to ten sites
with the operator-only harness:

```powershell
npm run audit:validate -- https://business-one.example https://business-two.example
```

Add `--detailed` before the URLs to include bounded finding evidence for
false-positive and business-usefulness review:

```powershell
npm run audit:validate -- --detailed https://business-one.example
```

The command runs the same bounded audit service and prints a JSON summary for
each target. It does not create accounts, persist audit results, submit forms,
or change the monitored websites. Use only URLs you are authorized to test;
the production readiness gate is five to ten representative businesses with
the findings reviewed for false positives and business usefulness.
