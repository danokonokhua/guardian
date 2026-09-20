import "server-only";

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { getPrisma } from "@/db/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { hashPassword, validatePassword } from "@/lib/auth/password";

export interface SignupInput {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
}

export interface SignupResult {
  userId: string;
  organizationId: string;
}

function slugBase(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "guardian"
  );
}

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/** Creates a user and their first owner organization atomically. */
export async function registerAccount(
  input: SignupInput,
  prisma: PrismaClient = getPrisma(),
): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || undefined;
  // Keep the default deterministic and bounded even when a display name is
  // long; callers can provide a custom organization name when desired.
  const organizationName = input.organizationName?.trim() || "My Organization";
  const passwordError = validatePassword(input.password);
  if (passwordError !== null) throw new ValidationError(passwordError, { field: "password" });
  if (organizationName.length > 120) {
    throw new ValidationError("Organization name must be 120 characters or fewer.", {
      field: "organizationName",
    });
  }

  const userId = randomUUID();
  const organizationId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          name,
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      });
      await tx.authCredential.create({ data: { userId, passwordHash } });

      // RLS requires the new tenant id for the organization and membership
      // inserts, even though this request has no existing session yet.
      await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.organization.create({
        data: {
          id: organizationId,
          name: organizationName,
          slug: `${slugBase(organizationName)}-${organizationId.slice(0, 8)}`,
          ownerId: userId,
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId,
          userId,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });
    });
  } catch (error: unknown) {
    if (prismaCode(error) === "P2002") {
      throw new ConflictError("An account with that email already exists.");
    }
    throw error;
  }
  return { userId, organizationId };
}
