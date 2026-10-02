/* eslint-disable no-console */
import "./server-only-cli.cjs";

import { randomUUID } from "node:crypto";

async function main() {
  const [
    { getPrisma },
    { validateDestination, sendDestination },
    { encryptDestination },
    { startJobBoss },
    { EXTERNAL_NOTIFICATION_JOB, sendDeliveryJob },
    { withGucContext },
  ] = await Promise.all([
    import("@/db/client"),
    import("@/lib/notification-destinations/transport"),
    import("@/lib/notification-destinations/secrets"),
    import("@/lib/jobs/boss"),
    import("@/lib/notification-destinations/queue"),
    import("@/db/tenant"),
  ]);

  const channelArg = (process.argv[2] ?? "").toUpperCase();
  const rawUrl = process.argv[3];
  const signingSecret = process.argv[4] ?? (channelArg === "WEBHOOK" ? "01234567890123456789012345678901" : undefined);

  if (!["SLACK", "TEAMS", "DISCORD", "WEBHOOK"].includes(channelArg) || !rawUrl) {
    console.log(JSON.stringify({
      status: "usage",
      message: "Usage: npx tsx scripts/notification-destination-smoke.ts <SLACK|DISCORD|TEAMS|WEBHOOK> <URL> [signingSecret] [orgId]",
      channels: ["SLACK", "DISCORD", "TEAMS", "WEBHOOK"],
    }, null, 2));
    process.exit(1);
  }

  const channel = channelArg as "SLACK" | "TEAMS" | "DISCORD" | "WEBHOOK";

  console.log(`[1/5] Validating destination URL for channel ${channel}...`);
  const validatedUrl = await validateDestination(channel, rawUrl);
  console.log(`      Valid destination host: ${validatedUrl.hostname}`);

  const prisma = getPrisma();
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    throw new Error("No organization found in database to attach destination to.");
  }
  const organizationId = process.argv[5] || org.id;
  console.log(`[2/5] Using organization: ${org.name} (${organizationId})`);

  // Direct transport test first to verify provider connectivity
  console.log(`[3/5] Testing direct outbound delivery to ${validatedUrl.hostname}...`);
  const testMessage = {
    deliveryId: randomUUID(),
    organizationId,
    issueId: null,
    title: "Guardian Test Alert",
    body: "This is an automated test from Guardian verifying webhook connectivity.",
    severity: "INFO",
    test: true,
    createdAt: new Date().toISOString(),
  };

  const directResult = await sendDestination(
    channel,
    { url: validatedUrl.href, ...(signingSecret ? { signingSecret } : {}) },
    testMessage,
  );

  console.log(`      Direct delivery result:`, directResult);
  if (!directResult.ok) {
    console.error(`[ERROR] Direct delivery failed: ${directResult.error} (status: ${directResult.status})`);
    process.exit(1);
  }

  console.log(`[4/5] Persisting destination and enqueueing pg-boss job for worker verification...`);
  const destinationId = randomUUID();
  const encryptedCredentials = encryptDestination(
    { url: validatedUrl.href, ...(signingSecret ? { signingSecret } : {}) },
    `${organizationId}:${destinationId}`,
  );

  await withGucContext({ organizationId }, async (tx) => {
    await tx.notificationDestination.create({
      data: {
        id: destinationId,
        organizationId,
        name: `Test ${channel} (${new Date().toLocaleTimeString()})`,
        channel,
        host: validatedUrl.hostname,
        credentials: encryptedCredentials,
        enabled: true,
      },
    });
  });

  const boss = await startJobBoss();
  await boss.createQueue(EXTERNAL_NOTIFICATION_JOB);

  const deliveryId = randomUUID();
  const dedupKey = `test:${Math.floor(Date.now() / 60000)}:${randomUUID().slice(0, 8)}`;

  await withGucContext({ organizationId }, async (tx) => {
    await tx.externalDelivery.create({
      data: {
        id: deliveryId,
        organizationId,
        destinationId,
        dedupKey,
        status: "PENDING",
      },
    });
    await sendDeliveryJob(tx, boss, organizationId, deliveryId);
  });

  console.log(`      Queued external delivery ${deliveryId}. Waiting for worker to deliver...`);
  console.log(`[5/5] Polling delivery outcome...`);

  let finalStatus = "PENDING";
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const record = await withGucContext({ organizationId }, (tx) =>
      tx.externalDelivery.findUnique({
        where: { id: deliveryId },
        select: { status: true, httpStatus: true, lastError: true, attempts: true, deliveredAt: true },
      }),
    );
    if (record) {
      if (record.status === "DELIVERED" || record.status === "FAILED") {
        finalStatus = record.status;
        console.log(`      Final status: ${record.status} (HTTP ${record.httpStatus}, attempts: ${record.attempts})`);
        if (record.lastError) console.log(`      Error: ${record.lastError}`);
        break;
      } else {
        console.log(`      Current status: ${record.status}...`);
      }
    }
  }

  console.log("\n==========================================");
  console.log(`RESULT: ${finalStatus}`);
  console.log("==========================================");

  await boss.stop({ graceful: true, timeout: 5000 });

  if (finalStatus !== "DELIVERED") {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
