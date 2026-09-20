# Guardian — Performance v1 monitoring contract

Performance v1 measures server-response time for the verified homepage. It is a
small, deterministic signal for the first MVP and is not a browser performance
audit.

## Contract

The worker makes one SSRF-safe `GET` request with a 10-second timeout and a 256 KiB
response limit. The elapsed duration uses a monotonic clock and includes reading
the bounded response. Redirects are not followed. A monitor may set
`config.maxResponseTimeMs` from 250 to 30,000 milliseconds; the default is 3,000.

- `UP`: a `2xx` homepage response completed within the threshold.
- `DOWN`: a `2xx` response exceeded the threshold, or the homepage returned a
  `4xx`/`5xx` status.
- `ERROR`: transport, outbound-policy, body-limit, unreadable-response, or
  redirect failures prevented a reliable measurement.

Results and issues store only flat bounded metrics (elapsed time, threshold,
status, and failure class). Page HTML, credentials, and redirect destinations are
not persisted.

Browser rendering, asset waterfalls, JavaScript execution, Lighthouse, Core Web
Vitals, and field data are later capabilities and must not be inferred from this
server-response monitor.
