# Domain Services

Framework-agnostic business logic for Guardian.

**Status (Phase 1B-01):** intentionally empty. The first services (tenant
context, RBAC guards, then the issue/scoring engines) arrive in later phases.

Rules of this directory (from the approved Phase 1A architecture):

- No Next.js, React, or HTTP imports — services must stay portable so they
  can later run inside the background worker process unchanged.
- Services receive an explicit context (tenant scope, logger) rather than
  reading ambient state.
