import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import {
  beginLoginAttempt,
  clearLoginThrottle,
  loginThrottleKeys,
} from "@/lib/auth/login-throttle";

type Bucket = {
  keyHash: string;
  windowStartedAt: Date;
  attempts: number;
  blockedUntil: Date | null;
  updatedAt: Date;
};

function createPrismaMock() {
  const buckets = new Map<string, Bucket>();
  const authLoginThrottle = {
    findUnique: async ({ where }: { where: { keyHash: string } }) =>
      buckets.get(where.keyHash) ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { keyHash: string };
      create: Omit<Bucket, "updatedAt">;
      update: Partial<Bucket>;
    }) => {
      const current = buckets.get(where.keyHash);
      const value: Bucket = current
        ? { ...current, ...update, updatedAt: new Date() }
        : { ...create, updatedAt: new Date() };
      buckets.set(where.keyHash, value);
      return value;
    },
    deleteMany: async ({ where }: { where: { keyHash: { in: string[] } } }) => {
      let count = 0;
      for (const key of where.keyHash.in) count += buckets.delete(key) ? 1 : 0;
      return { count };
    },
  };
  const prisma = {
    authLoginThrottle,
    $transaction: async (
      operation: (tx: { authLoginThrottle: typeof authLoginThrottle }) => unknown,
    ) => operation({ authLoginThrottle }),
  } as unknown as PrismaClient;
  return { prisma, buckets };
}

describe("login throttle", () => {
  let request: Request;

  beforeEach(() => {
    request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
    });
  });

  it("stores only deterministic hashes, not the email or IP address", () => {
    const keys = loginThrottleKeys(request, "owner@example.com");
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(keys.join("")).not.toContain("owner@example.com");
    expect(keys.join("")).not.toContain("203.0.113.10");
  });

  it("blocks after five attempts for one source without locking the account globally", async () => {
    const { prisma } = createPrismaMock();
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(beginLoginAttempt(prisma, request, "owner@example.com")).resolves.toEqual({
        limited: false,
      });
    }
    await expect(beginLoginAttempt(prisma, request, "owner@example.com")).resolves.toEqual({
      limited: false,
    });
    await expect(beginLoginAttempt(prisma, request, "owner@example.com")).resolves.toMatchObject({
      limited: true,
      retryAfterSeconds: expect.any(Number),
    });

    const differentSource = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.25" },
    });
    await expect(beginLoginAttempt(prisma, differentSource, "owner@example.com")).resolves.toEqual({
      limited: false,
    });
  });

  it("clears the current source buckets after successful authentication", async () => {
    const { prisma, buckets } = createPrismaMock();
    await beginLoginAttempt(prisma, request, "owner@example.com");
    expect(buckets.size).toBe(2);
    await clearLoginThrottle(prisma, request, "owner@example.com");
    expect(buckets.size).toBe(0);
  });
});
