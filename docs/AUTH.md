# Guardian — Local Authentication

Guardian uses PostgreSQL-backed local authentication so the application can be
deployed as a self-contained Docker Compose stack on a VPS. There is no
Supabase Auth dependency.

## Architecture

```
HTTP cookie (guardian_session)
        ↓ SHA-256 token lookup
auth_sessions + users
        ↓
lib/auth/context.ts
        ↓
tenant membership and role authorization
```

- `AuthCredential` stores a scrypt password hash and lockout counters.
- `AuthSession` stores only a hash of the random cookie token.
- `PasswordResetToken` stores only a hash of a short-lived reset token.
- `lib/auth/adapter.ts` is the only application seam for resolving identity.
- Tenant membership remains authoritative in `organization_members`.

## User flows

- `POST /api/auth/login` validates credentials, applies the five-attempt
  lockout policy, and sets an HTTP-only, SameSite=Lax session cookie.
- `POST /api/auth/logout` revokes the current session and redirects to login.
- `POST /api/auth/forgot-password` creates a one-hour reset token. With SMTP
  configured it emails the link; in local development it logs the link.
- `POST /api/auth/reset-password` consumes the token, updates the scrypt hash,
  and revokes existing sessions.

## Initial account

The Compose `bootstrap` service runs `npm run auth:bootstrap` after migrations.
Set `GUARDIAN_ADMIN_EMAIL`, `GUARDIAN_ADMIN_PASSWORD`, and optionally the name
and organization variables in `.env`. The command is idempotent: it
creates the account and owner membership once, then leaves existing data intact.

## Security rules

- Passwords, reset tokens, and session tokens are never logged or stored in
  plaintext.
- Cookies are marked `Secure` when `NEXT_PUBLIC_APP_URL` uses HTTPS.
- Login errors are intentionally generic so they do not disclose whether an
  email exists.
- Authorization still fails closed for suspended users and non-members.
