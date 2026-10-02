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
      const plan = event.plan || "PRO";
      const status: SubscriptionStatus =
        event.status === "active"
          ? "ACTIVE"
          : event.status === "past_due"
            ? "PAST_DUE"
            : event.status === "canceled"
              ? "CANCELED"
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
          provider: "STRIPE",
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
        },
        update: {
          plan,
          status,
          provider: "STRIPE",
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
        },
      });
    }

    if (event.eventType === "invoice.payment_succeeded" && event.amountCents) {
      await prisma.billingInvoice.create({
        data: {
          organizationId: event.organizationId,
          amountCents: event.amountCents,
          status: "PAID",
          invoiceNumber: event.invoiceNumber,
          hostedInvoiceUrl: event.hostedInvoiceUrl,
          pdfUrl: event.pdfUrl,
        },
      });
    }
  }

  return jsonResponse({ received: true }, 200);
});
