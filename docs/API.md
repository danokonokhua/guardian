# Guardian — API Foundation (Phase 1B-06)

## Architecture

```
HTTP REQUEST
    ↓  /api/v1 boundary (withApiRoute: request-id resolution, error boundary)
REQUEST CONTEXT   { requestId, params }
    ↓
IDENTITY CONTEXT  lib/auth/context.ts (getCurrentUser/requireUser/…)
    ↓
TENANT CONTEXT    requireOrganizationMember / requireRole / tenantContextFor
    ↓
AUTHORIZATION     lib/auth/authorization.ts (deny-by-default role ranks)
    ↓
VALIDATION        lib/validation.ts (zod → ValidationError)
    ↓
APPLICATION SERVICE  services/* (thin DTO boundary; no HTTP concerns)
    ↓
DATABASE          db/client.ts (server-only Prisma) — via repositories
```

The API layer **never** bypasses `lib/auth/context.ts` and never imports an
auth provider directly (the adapter seam from Phase 1B-05 stays intact).

## Response contract (`/api/v1`)

Success: `{ "data": {…}, "requestId": "…" }` — see `apiSuccess` in `lib/api.ts`.
Error: `{ "error": { "code", "message", "requestId", "details?" } }` (the
existing Phase 1A/1B-01 envelope; `details` only for validation).

Status mapping (existing taxonomy, `lib/errors.ts`): 400 `VALIDATION_ERROR` ·
401 `UNAUTHORIZED` · 403 `FORBIDDEN` · 404 `NOT_FOUND` (also masks
cross-tenant probing) · 500 `INTERNAL_ERROR` (sanitized; details only logged).

Every response carries `x-request-id`.

## Request IDs

`resolveRequestId`: a client `x-request-id` is propagated ONLY if it matches
`^[A-Za-z0-9][A-Za-z0-9._-]{7,63}$` (safe charset, ≤64 chars); otherwise a
server UUID is generated. Oversized/malformed/injection-style ids are never
echoed.

## Endpoints (Phase 1B-06 — architectural only)

| Route                                                | Purpose                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/health`                                 | Non-sensitive liveness in the v1 envelope                                                                                                                                                                    |
| `GET /api/v1/organizations/{organizationId}/context` | **Architectural test endpoint**: proves request → identity → membership → authorization → validation → service → envelope. `?minimumRole=` raises the route's own bar (never grants). Not a product feature. |

Legacy `/api/health` and `/api/health/ready` remain unchanged.

## Security model

- Identity originates ONLY from the `AuthAdapter` boundary; authorization ONLY
  from the identity/membership repository. Client-supplied `userId`,
  `organizationId`, role, or email are never treated as proof of anything.
- `organizationId` in the path is a lookup key; non-members and INVITED
  members receive 404 (fail-closed, existence masking).
- Validation failures echo field path + message only — never received values.
- Never logged: passwords, tokens, cookies, authorization headers, API keys,
  connection strings (logger redaction + boundary tests).

## Deliberately NOT implemented (later phases)

Login/signup/sessions/cookies/Supabase wiring · product endpoints (websites,
monitoring, issues, reports, notifications) · rate limiting · pagination ·
API keys · webhooks · versioning beyond `/v1` prefix.

## How future services consume this foundation

1. Define the route under `app/api/v1/…` using `withApiRoute`.
2. Validate input with `parseWith(zodSchema, input, location)`.
3. Authorize with `requireUser` / `requireOrganizationMember` / `requireRole`.
4. Call a `services/<domain>` function (never Prisma from the route).
5. Return `apiSuccess(dto, requestId)`.
