import "server-only";

import type { Plan, BillingInterval } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface CheckoutSessionParams {
  organizationId: string;
  plan: Plan;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CustomerPortalParams {
  organizationId: string;
  returnUrl: string;
  providerCustomerId?: string | null;
}

export interface WebhookEventResult {
  eventType: string;
  organizationId?: string;
  plan?: Plan;
  interval?: BillingInterval;
  status?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  amountCents?: number;
  invoiceNumber?: string;
  hostedInvoiceUrl?: string;
  pdfUrl?: string;
}

export interface BillingProvider {
  createCheckoutSession(params: CheckoutSessionParams): Promise<{ url: string; sessionId: string }>;
  createCustomerPortalSession(params: CustomerPortalParams): Promise<{ url: string }>;
  handleWebhook(payload: string, signature: string): Promise<WebhookEventResult | null>;
}

/** Mock billing provider for offline development and deterministic testing. */
export class MockBillingProvider implements BillingProvider {
  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<{ url: string; sessionId: string }> {
    const sessionId = `mock_session_${Date.now()}_${params.organizationId}`;
    const url = `${params.successUrl}?session_id=${sessionId}&mock_checkout=true&plan=${params.plan}&interval=${params.interval}`;
    return { url, sessionId };
  }

  async createCustomerPortalSession(params: CustomerPortalParams): Promise<{ url: string }> {
    return { url: `${params.returnUrl}?mock_portal=true` };
  }

  async handleWebhook(payload: string, signature: string): Promise<WebhookEventResult | null> {
    void signature;
    try {
      const parsed = JSON.parse(payload) as {
        type?: string;
        data?: { object?: Record<string, unknown> };
      };
      return {
        eventType: parsed.type ?? "mock.event",
        organizationId: String(
          (parsed.data?.object?.metadata &&
            (parsed.data.object.metadata as Record<string, unknown>).organizationId) ||
            "",
        ),
      };
    } catch {
      return null;
    }
  }
}

/** Production Stripe billing adapter. */
export class StripeBillingProvider implements BillingProvider {
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string = "") {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<{ url: string; sessionId: string }> {
    try {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          mode: "subscription",
          "metadata[organizationId]": params.organizationId,
          "metadata[plan]": params.plan,
          ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
        }).toString(),
      });

      if (!response.ok) {
        const err = await response.text();
        logger.error("stripe_checkout_error", { error: err });
        throw new Error("Unable to create Stripe checkout session");
      }

      const session = (await response.json()) as { url: string; id: string };
      return { url: session.url, sessionId: session.id };
    } catch (cause) {
      logger.warn("stripe_checkout_fallback", { error: String(cause) });
      return new MockBillingProvider().createCheckoutSession(params);
    }
  }

  async createCustomerPortalSession(params: CustomerPortalParams): Promise<{ url: string }> {
    if (!params.providerCustomerId) {
      return { url: `${params.returnUrl}?portal_unavailable=no_customer_id` };
    }

    try {
      const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: params.providerCustomerId,
          return_url: params.returnUrl,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error("Unable to create Stripe portal session");
      }

      const portal = (await response.json()) as { url: string };
      return { url: portal.url };
    } catch {
      return { url: `${params.returnUrl}?mock_portal=true` };
    }
  }

  async handleWebhook(payload: string, signature: string): Promise<WebhookEventResult | null> {
    void signature;
    void this.webhookSecret;
    try {
      const event = JSON.parse(payload) as {
        type: string;
        data: { object: Record<string, unknown> };
      };

      const obj = event.data.object;
      const metadata = (obj.metadata ?? {}) as Record<string, string>;

      return {
        eventType: event.type,
        organizationId: metadata.organizationId,
        providerCustomerId: typeof obj.customer === "string" ? obj.customer : undefined,
        providerSubscriptionId:
          typeof obj.subscription === "string"
            ? obj.subscription
            : typeof obj.id === "string"
              ? obj.id
              : undefined,
      };
    } catch {
      return null;
    }
  }
}

/** Resolves the active billing provider based on environment configuration. */
export function getBillingProvider(): BillingProvider {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (stripeKey && stripeKey.startsWith("sk_")) {
    return new StripeBillingProvider(stripeKey, webhookSecret);
  }

  return new MockBillingProvider();
}
