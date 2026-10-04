import { beforeEach, describe, expect, it, vi } from "vitest";

const { orgUpdateMock, subUpsertMock, invoiceCreateMock } = vi.hoisted(() => ({
  orgUpdateMock: vi.fn(),
  subUpsertMock: vi.fn(),
  invoiceCreateMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getPrisma: () => ({
    organization: { update: orgUpdateMock },
    subscription: { upsert: subUpsertMock },
    billingInvoice: { create: invoiceCreateMock },
  }),
}));

import { GET as webhookGET, POST as webhookPOST } from "@/app/api/webhooks/stripe/route";
import { POST as simulatePOST, GET as simulateGET } from "@/app/api/webhooks/stripe/simulate/route";

describe("Stripe Webhook and Simulation Route Handlers", () => {
  const ORG_ID = "org-test-uuid-1234";

  beforeEach(() => {
    orgUpdateMock.mockReset().mockResolvedValue({ id: ORG_ID, plan: "PRO" });
    subUpsertMock.mockReset().mockResolvedValue({ id: "sub-1", organizationId: ORG_ID });
    invoiceCreateMock.mockReset().mockResolvedValue({ id: "inv-1", organizationId: ORG_ID });
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("GET /api/webhooks/stripe returns sandbox mode status when secrets unconfigured", async () => {
    const res = await webhookGET(new Request("https://guardian.test/api/webhooks/stripe"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.mode).toBe("sandbox");
    expect(json.signingMethod).toBe("sandbox_bypass_allowed");
  });

  it("GET /api/webhooks/stripe/simulate returns simulator capability metadata", async () => {
    const res = await simulateGET(
      new Request("https://guardian.test/api/webhooks/stripe/simulate"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ready");
    expect(json.supportedEvents).toContain("customer.subscription.updated");
    expect(json.supportedEvents).toContain("invoice.payment_succeeded");
  });

  it("POST /api/webhooks/stripe/simulate rejects requests without organizationId", async () => {
    const res = await simulatePOST(
      new Request("https://guardian.test/api/webhooks/stripe/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing organizationId");
  });

  it("POST /api/webhooks/stripe/simulate triggers simulated subscription upgrade", async () => {
    const res = await simulatePOST(
      new Request("https://guardian.test/api/webhooks/stripe/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG_ID,
          eventType: "customer.subscription.updated",
          plan: "PRO",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.simulated).toBe(true);
    expect(orgUpdateMock).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { plan: "PRO" },
    });
    expect(subUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
        create: expect.objectContaining({ plan: "PRO", status: "ACTIVE" }),
      }),
    );
  });

  it("POST /api/webhooks/stripe/simulate triggers simulated invoice payment", async () => {
    const res = await simulatePOST(
      new Request("https://guardian.test/api/webhooks/stripe/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG_ID,
          eventType: "invoice.payment_succeeded",
          amountCents: 5900,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.simulated).toBe(true);
    expect(invoiceCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          amountCents: 5900,
          status: "PAID",
        }),
      }),
    );
  });

  it("POST /api/webhooks/stripe/simulate triggers simulated subscription cancelation", async () => {
    const res = await simulatePOST(
      new Request("https://guardian.test/api/webhooks/stripe/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ORG_ID,
          eventType: "customer.subscription.deleted",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(orgUpdateMock).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: { plan: "FREE" },
    });
    expect(subUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
        create: expect.objectContaining({ plan: "FREE", status: "CANCELED" }),
      }),
    );
  });

  it("POST /api/webhooks/stripe rejects invalid signature when live secrets are present", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_123456789";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_live_abcdef123456";

    const res = await webhookPOST(
      new Request("https://guardian.test/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "t=123,v1=tampered_signature",
        },
        body: JSON.stringify({ type: "customer.subscription.updated" }),
      }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.received).toBe(false);
  });
});
