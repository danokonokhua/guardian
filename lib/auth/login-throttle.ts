import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { serverConfig } from "@/config/server";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 60_000;

type ThrottleResult = { limited: boolean; retryAfterSeconds?: number };

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Returns the deployment-trusted source address used for abuse controls. */
export function requestClientAddress(request: Request): string {
  // Forwarding headers are client-controlled unless the deployment explicitly
  // places a sanitizing reverse proxy in front of the app and proves it with
  // the shared internal header.
  const proxyToken = serverConfig.server.trustedProxyToken;
  const crossedTrustedProxy =
    serverConfig.server.trustedProxy === true &&
    proxyToken !== undefined &&
    request.headers.get("x-guardian-proxy-token") === proxyToken;
  if (!crossedTrustedProxy && serverConfig.isProduction) return "direct";
  const forwarded = request.headers.get("x-forwarded-for");
  const forwardedAddress = forwarded?.split(",", 1)[0]?.trim();
  const realAddress = request.headers.get("x-real-ip")?.trim();
  return forwardedAddress || realAddress || "unknown";
}

export function loginThrottleKeys(request: Request, email: string): string[] {
  const address = requestClientAddress(request).toLowerCase();
  return [digest(`ip:${address}`), digest(`ip-email:${address}\u0000${email}`)];
}

function retryAfterSeconds(blockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
}

async function reserveBuckets(
  tx: Pick<PrismaClient, "authLoginThrottle">,
  keyHashes: string[],
  now: Date,
): Promise<ThrottleResult> {
  const currentBuckets: Array<{
    keyHash: string;
    current: Awaited<ReturnType<PrismaClient["authLoginThrottle"]["findUnique"]>>;
  }> = [];
  for (const keyHash of keyHashes) {
    const current = await tx.authLoginThrottle.findUnique({ where: { keyHash } });
    if (
      current?.blockedUntil !== null &&
      current?.blockedUntil !== undefined &&
      current.blockedUntil > now
    ) {
      return { limited: true, retryAfterSeconds: retryAfterSeconds(current.blockedUntil, now) };
    }
    currentBuckets.push({ keyHash, current });
  }

  const nextBuckets = currentBuckets.map(({ keyHash, current }) => {
    const windowExpired =
      current === null || now.getTime() - current.windowStartedAt.getTime() >= WINDOW_MS;
    const attempts = windowExpired ? 1 : current.attempts + 1;
    // Allow the fifth attempt to complete; block the next attempt. A valid
    // fifth login can then clear the source buckets without a false 429.
    const blockedUntil = attempts > MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null;
    return { keyHash, current, windowExpired, attempts, blockedUntil };
  });

  for (const bucket of nextBuckets) {
    await tx.authLoginThrottle.upsert({
      where: { keyHash: bucket.keyHash },
      create: {
        keyHash: bucket.keyHash,
        windowStartedAt: now,
        attempts: bucket.attempts,
        blockedUntil: bucket.blockedUntil,
      },
      update: {
        windowStartedAt: bucket.windowExpired ? now : bucket.current!.windowStartedAt,
        attempts: bucket.attempts,
        blockedUntil: bucket.blockedUntil,
      },
    });
  }

  const blocked = nextBuckets.find((bucket) => bucket.blockedUntil !== null);
  return blocked === undefined
    ? { limited: false }
    : { limited: true, retryAfterSeconds: retryAfterSeconds(blocked.blockedUntil!, now) };
}

/** Atomically reserves one login attempt for the source and source/email pair. */
export async function beginLoginAttempt(
  prisma: PrismaClient,
  request: Request,
  email: string,
): Promise<ThrottleResult> {
  const now = new Date();
  const keyHashes = loginThrottleKeys(request, email);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => reserveBuckets(tx, keyHashes, now), {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Login throttle transaction did not complete.");
}

export async function clearLoginThrottle(
  prisma: PrismaClient,
  request: Request,
  email: string,
): Promise<void> {
  await prisma.authLoginThrottle.deleteMany({
    where: { keyHash: { in: loginThrottleKeys(request, email) } },
  });
}
