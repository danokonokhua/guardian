-- Persistent, hashed login throttling buckets.
-- Keys contain only SHA-256 digests of the requester's IP and normalized email.

CREATE TABLE "auth_login_throttles" (
    "keyHash" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_login_throttles_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "auth_login_throttles_blockedUntil_idx"
  ON "auth_login_throttles"("blockedUntil");

REVOKE ALL ON TABLE "auth_login_throttles" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth_login_throttles" TO guardian_app;
  END IF;
END
$$;
