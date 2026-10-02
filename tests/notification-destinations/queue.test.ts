import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const start = vi.hoisted(() => vi.fn());
vi.mock("@/lib/jobs/boss", () => ({ startJobBoss: start }));
import {
  queueDestinationAlerts,
  EXTERNAL_NOTIFICATION_JOB,
} from "@/lib/notification-destinations/queue";

it("starts the web producer and creates its queue before the first manual escalation", async () => {
  const createQueue = vi.fn(async () => {});
  const send = vi.fn(async () => "job-id");
  start.mockResolvedValue({ createQueue, send });
  const tx = {
    notificationDestination: { findMany: vi.fn(async () => [{ id: "destination" }]) },
    externalDelivery: {
      createMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "delivery" })),
    },
  } as unknown as Prisma.TransactionClient;
  expect(await queueDestinationAlerts(tx, "organization", "issue", "window")).toBe(1);
  expect(start).toHaveBeenCalledOnce();
  expect(createQueue).toHaveBeenCalledWith(EXTERNAL_NOTIFICATION_JOB);
  expect(createQueue.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
  expect(send).toHaveBeenCalledWith(
    EXTERNAL_NOTIFICATION_JOB,
    { organizationId: "organization", deliveryId: "delivery" },
    expect.objectContaining({ db: expect.objectContaining({ executeSql: expect.any(Function) }) }),
  );
});
