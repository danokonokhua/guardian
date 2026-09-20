# Guardian — Critical lead form monitoring v1

Critical lead forms are a revenue-protection signal from the PRD. The first
implementation is deliberately safe: it verifies one explicitly named,
server-rendered form on a configured page and can optionally send a `HEAD`
request to a same-origin health endpoint. It never submits a form, sends lead
data, follows redirects, or calls an external action URL.

## Configuration

Create a `FORM` monitor with a strict configuration object:

```json
{
  "formId": "contact-form",
  "pagePath": "/contact",
  "probePath": "/api/lead-health"
}
```

`formId` is required and must match the form's exact `id` or `name` attribute.
`pagePath` defaults to `/`; `probePath` is optional. Both paths must be
same-origin relative paths without query strings, fragments, whitespace, or
embedded credentials.

## Outcomes and evidence

- `UP`: exactly one matching form is present, and an optional probe returns
  `2xx`.
- `DOWN`: the page or optional probe returns `4xx`/`5xx`, the form is missing or
  ambiguous, or the form method/action is unsafe or unsupported.
- `ERROR`: transport, body-read, redirect, invalid URL, or invalid configuration
  prevents a reliable check.

The result and issue evidence contain only bounded paths, statuses, method,
form-presence, probe mode, and elapsed time. HTML bodies, form fields, tokens,
credentials, query strings, and submitted data are not persisted. Failures are
recorded as `monitor.form` at `CRITICAL` severity with business impact and a
recommended action.

This v1 contract proves page/form availability only; it does not prove that a
real lead reached email, CRM, WhatsApp, payment, or another downstream system.
A future synthetic submission requires an explicit canary, CSRF-safe design,
secret handling, rate limits, and a separate approval decision.
