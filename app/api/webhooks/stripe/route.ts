import { withRoute, jsonResponse } from "@/lib/api";
import { getBillingProvider } from "@/services/billing/provider";
import { getPrisma } from "@/db/client";
import { logger } from "@/lib/logger";
import type { SubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request, { requestId }) => {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  const provider = getBillingProvider();
  const event = await provider.handleWebhook(payload, signature);

  if (!event) {
    return jsonResponse({ received: false, error: "Invalid webhook payload or signature" }, 400);
  }

  logger.info("stripe_webhook_received", {
    eventType: event.eventType,
    organizationId: event.organizationId,
    requestId,
  });

  if (event.organizationId) {
    const prisma = getPrisma();

    // Map common Stripe events
    if (event.eventType.startsWith("customer.subscription.")) {
      if (event.eventType === "customer.subscription.deleted") {
        await prisma.organization.update({
          where: { id: event.organizationId },
          data: { plan: "FREE" },
        });

        await prisma.subscription.upsert({
          where: { organizationId: event.organizationId },
          create: {
            organizationId: event.organizationId,
            plan: "FREE",
            status: "CANCELED",
            interval: "MONTHLY",
            provider: "STRIPE",
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
          },
          update: {
            plan: "FREE",
            status: "CANCELED",
            provider: "STRIPE",
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
          },
        });
      } else {
        const plan = event.plan || "PRO";
        const status: SubscriptionStatus =
          event.status === "active"
            ? "ACTIVE"
            : event.status === "past_due"
              ? "PAST_DUE"
              : event.status === "canceled"
                ? "CANCELED"
                : event.status === "trialing"
                  ? "TRIALING"
                  : "ACTIVE";

        await prisma.organization.update({
          where: { id: event.organizationId },
          data: { plan },
        });

        await prisma.subscription.upsert({
          where: { organizationId: event.organizationId },
          create: {
            organizationId: event.organizationId,
            plan,
            status,
            interval: event.interval ?? "MONTHLY",
            provider: "STRIPE",
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
          },
          update: {
            plan,
            status,
            interval: event.interval ?? "MONTHLY",
            provider: "STRIPE",
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
          },
        });
      }
    }

    if (
      (event.eventType === "invoice.payment_succeeded" || event.eventType === "invoice.paid") &&
      event.amountCents
    ) {
      await prisma.billingInvoice.create({
        data: {
          organizationId: event.organizationId,
          amountCents: event.amountCents,
          status: "PAID",
          invoiceNumber: event.invoiceNumber ?? `INV-${Date.now().toString().slice(-6)}`,
          hostedInvoiceUrl:
            event.hostedInvoiceUrl ?? "https://billing.stripe.com/p/session/test_invoice",
          pdfUrl: event.pdfUrl ?? "https://pay.stripe.com/invoice/test.pdf",
          paidAt: new Date(),
        },
      });
    }
  }

  return jsonResponse(
    {
      received: true,
      eventType: event.eventType,
      simulated: Boolean(event.isSimulated),
    },
    200,
  );
});

export const GET = withRoute(async () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isLiveConfigured = Boolean(
    stripeKey && stripeKey.startsWith("sk_") && webhookSecret && webhookSecret.startsWith("whsec_"),
  );

  return jsonResponse({
    status: "ok",
    mode: isLiveConfigured ? "live" : "sandbox",
    webhookConfigured: Boolean(webhookSecret && webhookSecret.startsWith("whsec_")),
    signingMethod: isLiveConfigured ? "hmac_sha256" : "sandbox_bypass_allowed",
  });
});
