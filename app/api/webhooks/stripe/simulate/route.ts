import { withRoute, jsonResponse } from "@/lib/api";
import { POST as stripeWebhookPOST } from "../route";
import type { Plan, BillingInterval } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Endpoint to trigger simulated Stripe webhook events for demo and testing.
 * Accessible when live Stripe webhooks are not yet connected.
 */
export const POST = withRoute(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    eventType?: string;
    plan?: Plan;
    amountCents?: number;
    interval?: BillingInterval;
  };

  if (!body.organizationId) {
    return jsonResponse({ error: "Missing organizationId" }, 400);
  }

  const eventType = body.eventType || "customer.subscription.updated";
  const plan = body.plan || "PRO";
  const interval = body.interval || "MONTHLY";
  const amountCents = body.amountCents ?? 5900;
  const now = Math.floor(Date.now() / 1000);

  let simulatedPayload: Record<string, unknown>;

  if (eventType === "invoice.payment_succeeded" || eventType === "invoice.paid") {
    simulatedPayload = {
      id: `evt_sim_${Date.now()}`,
      object: "event",
      type: eventType,
      created: now,
      data: {
        object: {
          id: `in_sim_${Date.now()}`,
          customer: `cus_sim_${body.organizationId.slice(0, 8)}`,
          amount_paid: amountCents,
          number: `INV-${Date.now().toString().slice(-6)}`,
          hosted_invoice_url: "https://billing.stripe.com/p/session/test_simulated_invoice",
          invoice_pdf: "https://pay.stripe.com/invoice/test_simulated.pdf",
          metadata: {
            organizationId: body.organizationId,
            plan,
          },
        },
      },
    };
  } else {
    simulatedPayload = {
      id: `evt_sim_${Date.now()}`,
      object: "event",
      type: eventType,
      created: now,
      data: {
        object: {
          id: `sub_sim_${Date.now()}`,
          customer: `cus_sim_${body.organizationId.slice(0, 8)}`,
          status: eventType === "customer.subscription.deleted" ? "canceled" : "active",
          metadata: {
            organizationId: body.organizationId,
            plan,
          },
          interval,
        },
      },
    };
  }

  // Forward through real stripe webhook handler with sandbox mock_signature
  const webhookReq = new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "mock_signature",
    },
    body: JSON.stringify(simulatedPayload),
  });

  return stripeWebhookPOST(webhookReq);
});

export const GET = withRoute(async () => {
  return jsonResponse({
    status: "ready",
    description: "Stripe Webhook Sandbox Simulator",
    supportedEvents: [
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
    ],
    usage: {
      method: "POST",
      body: {
        organizationId: "UUID",
        eventType:
          "customer.subscription.updated | invoice.payment_succeeded | customer.subscription.deleted",
        plan: "GROWTH | PRO | AGENCY",
        amountCents: 5900,
        interval: "MONTHLY | ANNUAL",
      },
    },
  });
});
