import "./server-only-cli.cjs";

import { randomUUID } from "node:crypto";

async function main(): Promise<void> {
  const [{ serverConfig }, { getPrisma }, { hashPassword, validatePassword }, { withGucContext }] =
    await Promise.all([
      import("@/config/server"),
      import("@/db/client"),
      import("@/lib/auth/password"),
      import("@/db/tenant"),
    ]);
  const email = serverConfig.server.guardianAdminEmail?.trim().toLowerCase();
  const password = serverConfig.server.guardianAdminPassword;
  if (email === undefined || !email.includes("@")) {
    throw new Error("GUARDIAN_ADMIN_EMAIL must be a valid email address.");
  }
  if (password === undefined) throw new Error("GUARDIAN_ADMIN_PASSWORD is required.");
  const passwordError = validatePassword(password);
  if (passwordError !== null) throw new Error(`GUARDIAN_ADMIN_PASSWORD: ${passwordError}`);

  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: "ACTIVE" },
    create: {
      email,
      name: serverConfig.server.guardianAdminName ?? "Guardian Owner",
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
  });

  const existingCredential = await prisma.authCredential.findUnique({ where: { userId: user.id } });
  if (existingCredential === null) {
    await prisma.authCredential.create({
      data: { userId: user.id, passwordHash: await hashPassword(password) },
    });
  }

  const memberships = await withGucContext({ userId: user.id }, (tx) =>
    tx.organizationMember.findMany({ where: { userId: user.id }, select: { id: true } }),
  );
  if (memberships.length === 0) {
    const organizationId = randomUUID();
    const name = serverConfig.server.guardianOrganizationName ?? "Guardian Organization";
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guardian";
    await withGucContext({ organizationId, userId: user.id }, async (tx) => {
      await tx.organization.create({
        data: { id: organizationId, name, slug: `${slugBase}-${organizationId.slice(0, 8)}`, ownerId: user.id },
      });
      await tx.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      });
    });
  }

  process.stdout.write(`Guardian owner account ready for ${email}.\n`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  process.stderr.write(`guardian_bootstrap_failed: ${String(error)}\n`);
  process.exitCode = 1;
});
