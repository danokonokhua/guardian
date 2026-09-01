# Guardian — Identity & Authorization Foundation (Phase 1B-05)

## Architecture

```
AUTH PROVIDER (approved: Supabase Auth — wired through lib/auth/supabase-adapter.ts)
      ↓
AUTH ADAPTER            lib/auth/adapter.ts   (only layer touching sessions/tokens)
      ↓
GUARDIAN IDENTITY CONTEXT  lib/auth/context.ts (getCurrentUser / requireUser /
      ↓                                          requireOrganizationMember / requireRole)
APPLICATION SERVICES    (never import the adapter or provider SDKs)
```

- **Identity projection** (`lib/auth/identity.ts`): `AuthenticatedUser`,
  `MembershipContext`, `IdentityRepository` interface. The `User` /
  `OrganizationMember` Prisma models remain the single source of truth; no
  passwords, no auth secrets, no competing identity system.
- **Adapter**: `AuthAdapter` interface with a fail-closed `AnonymousAuthAdapter`
  default (no provider registered → every request unauthenticated). The Supabase
  adapter is registered via `setAuthAdapter()` in a later phase.
- **Repository**: `lib/auth/prisma-repository.ts` (server-only) implements
  user/membership lookups through the existing Prisma boundary — no second ORM,
  no raw SQL. Tests inject an in-memory fake via `setIdentityRepository()`.
- **Authorization** (`lib/auth/authorization.ts`): deny-by-default primitives
  over OWNER > ADMIN > MEMBER > VIEWER; only `ACTIVE` users and `ACTIVE`
  memberships authorize. The full permission matrix (Phase 1A §10) arrives with
  the API phase.

## Decision semantics

| Condition                                          | Result                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| No / stale / inactive identity                     | 401 `UNAUTHORIZED`                                                         |
| Not an ACTIVE member of the organization           | **404 `NOT_FOUND`** (existence masking — also covers cross-tenant probing) |
| Member but below required role                     | 403 `FORBIDDEN`                                                            |
| Membership bound to a different org than requested | 500 invariant error (`tenantContextFor`) — never a silent tenant switch    |

Client-supplied `userId` / `organizationId` are never proof of authorization:
the adapter's identity plus the repository's membership relationship decide.

## Known limitations / deferred

- Supabase Auth is used automatically when `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured. When either is absent, the
  adapter remains anonymous and all protected access fails closed.
- `/login` provides the initial password sign-in flow, while `proxy.ts`
  refreshes the provider session cookie before protected dashboard/API requests.
- Signup, recovery, MFA, and provider-specific account flows remain later work.
- Permission-matrix helpers, RLS, and route-level guards arrive with the API.
- Live-database integration tests for the Prisma repository are deferred until
  a real database is configured (documented boundary; unit tests cover logic).
