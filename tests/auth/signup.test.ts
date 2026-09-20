import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { registerAccount } from "@/lib/auth/signup";

vi.mock("@/lib/auth/password", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/password")>("@/lib/auth/password");
  return { ...actual, hashPassword: vi.fn().mockResolvedValue("scrypt-hash") };
});

function prismaFixture() {
  const tx = {
    user: { create: vi.fn().mockResolvedValue(undefined) },
    authCredential: { create: vi.fn().mockResolvedValue(undefined) },
    organization: { create: vi.fn().mockResolvedValue(undefined) },
    organizationMember: { create: vi.fn().mockResolvedValue(undefined) },
    $executeRaw: vi.fn().mockResolvedValue(0),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
      callback(tx),
    ),
  } as unknown as PrismaClient;
  return { prisma, tx };
}

describe("registerAccount", () => {
  it("creates identity, credentials, and an owner tenant in one RLS-scoped transaction", async () => {
    const { prisma, tx } = prismaFixture();

    const result = await registerAccount(
      {
        email: " Alice@Example.com ",
        password: "correct horse battery staple",
        name: "Alice",
        organizationName: "Acme Operations",
      },
      prisma,
    );

    expect(result.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.organizationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: result.userId,
          email: "alice@example.com",
          name: "Alice",
          status: "ACTIVE",
        }),
      }),
    );
    expect(tx.authCredential.create).toHaveBeenCalledWith({
      data: { userId: result.userId, passwordHash: "scrypt-hash" },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: result.organizationId,
          name: "Acme Operations",
          ownerId: result.userId,
        }),
      }),
    );
    expect(tx.organizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: result.organizationId,
          userId: result.userId,
          role: "OWNER",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("converts a unique-email violation into a safe conflict error", async () => {
    const { prisma, tx } = prismaFixture();
    tx.user.create.mockRejectedValue({ code: "P2002" });

    await expect(
      registerAccount(
        { email: "owner@example.com", password: "correct horse battery staple" },
        prisma,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
      message: "An account with that email already exists.",
    });
  });
});
