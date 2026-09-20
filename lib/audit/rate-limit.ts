import "server-only";

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { requestClientAddress } from "@/lib/auth/login-throttle";
import { RateLimitError } from "@/lib/errors";

const WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;
const BLOCK_MS = 5 * 60_000;

type Bucket = Awaited<ReturnType<PrismaClient["authLoginThrottle"]["findUnique"]>>;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function retryAfterSeconds(blockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
}

function serializationConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

async function reserve(
  tx: Pick<PrismaClient, "authLoginThrottle">,
  keyHashes: string[],
  now: Date,
): Promise<number | null> {
  const buckets: Array<{ keyHash: string; current: Bucket }> = [];
  for (const keyHash of keyHashes) {
    const current = await tx.authLoginThrottle.findUnique({ where: { keyHash } });
    if (current?.blockedUntil !== null && current?.blockedUntil !== undefined) {
      if (current.blockedUntil > now) return retryAfterSeconds(current.blockedUntil, now);
    }
    buckets.push({ keyHash, current });
  }

  const next = buckets.map(({ keyHash, current }) => {
    const expired =
      current === null || now.getTime() - current.windowStartedAt.getTime() >= WINDOW_MS;
    const attempts = expired ? 1 : current.attempts + 1;
    const blockedUntil = attempts > MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null;
    return { keyHash, current, expired, attempts, blockedUntil };
  });

  for (const bucket of next) {
    await tx.authLoginThrottle.upsert({
      where: { keyHash: bucket.keyHash },
      create: {
        keyHash: bucket.keyHash,
        windowStartedAt: now,
        attempts: bucket.attempts,
        blockedUntil: bucket.blockedUntil,
      },
      update: {
        windowStartedAt: bucket.expired ? now : bucket.current!.windowStartedAt,
        attempts: bucket.attempts,
        blockedUntil: bucket.blockedUntil,
      },
    });
  }

  const blocked = next.find((bucket) => bucket.blockedUntil !== null)?.blockedUntil;
  return blocked === undefined || blocked === null ? null : retryAfterSeconds(blocked, now);
}

/** Enforces a small, hashed, database-backed public-audit quota. */
export async function enforceAuditRateLimit(
  prisma: PrismaClient,
  request: Request,
  canonicalUrl: string,
): Promise<void> {
  const source = requestClientAddress(request).toLowerCase();
  const origin = new URL(canonicalUrl).origin.toLowerCase();
  const keyHashes = [digest(`audit-ip:${source}`), digest(`audit-target:${source}\u0000${origin}`)];
  const now = new Date();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const retryAfter = await prisma.$transaction((tx) => reserve(tx, keyHashes, now), {
        isolationLevel: "Serializable",
      });
      if (retryAfter !== null) {
        throw new RateLimitError("Free audits are limited. Please retry later.", {
          retryAfterSeconds: retryAfter,
        });
      }
      return;
    } catch (error) {
      if (error instanceof RateLimitError) throw error;
      if (!serializationConflict(error) || attempt === 2) throw error;
    }
  }
}
