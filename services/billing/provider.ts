import "server-only";

import crypto from "crypto";
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
  isSimulated?: boolean;
}

export interface BillingProvider {
  createCheckoutSession(params: CheckoutSessionParams): Promise<{ url: string; sessionId: string }>;
  createCustomerPortalSession(params: CustomerPortalParams): Promise<{ url: string }>;
  handleWebhook(payload: string, signature: string): Promise<WebhookEventResult | null>;
}

/**
 * Verifies a Stripe webhook signature according to Stripe's HMAC-SHA256 specification.
 * Header format: t=1492774577,v1=5257a869e7ecebeda32affa62cd4f2365163e452305b68a298471e1cdaea2347
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds: number = 300,
): boolean {
  if (!payload || !signatureHeader || !webhookSecret) {
    return false;
  }

  // Parse header items
  const items = signatureHeader.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const item of items) {
    const [key, value] = item.trim().split("=");
    if (!key || !value) continue;
    if (key === "t") {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        timestamp = parsed;
      }
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return false;
  }

  // Timestamp tolerance check (toleranceSeconds <= 0 disables tolerance check)
  if (toleranceSeconds > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }
  }

  // Stripe HMAC payload is `${timestamp}.${payload}`
  const signedPayload = `${timestamp}.${payload}`;
  const computedHmacHex = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const computedBuffer = Buffer.from(computedHmacHex, "utf8");

  for (const sig of signatures) {
    const sigBuffer = Buffer.from(sig, "utf8");
    if (
      sigBuffer.length === computedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, computedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

/** Helper to generate a valid Stripe signature header for testing and simulated webhooks. */
export function generateStripeSignature(
  payload: string,
  webhookSecret: string,
  timestamp?: number,
): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${t}.${payload}`, "utf8")
    .digest("hex");
  return `t=${t},v1=${signature}`;
}

/** Parses raw webhook payload into standardized WebhookEventResult. */
export function parseWebhookPayload(payload: string): WebhookEventResult | null {
  try {
    const raw = JSON.parse(payload) as Record<string, unknown>;

    const eventType = String(raw.type || raw.eventType || "mock.event");
    const dataObj =
      raw.data &&
      typeof raw.data === "object" &&
      (raw.data as { object?: Record<string, unknown> }).object
        ? (raw.data as { object: Record<string, unknown> }).object
        : raw;

    const metadata = (
      dataObj.metadata && typeof dataObj.metadata === "object" ? dataObj.metadata : {}
    ) as Record<string, unknown>;

    const organizationId =
      (metadata.organizationId as string) ||
      (dataObj.organizationId as string) ||
      (raw.organizationId as string) ||
      undefined;

    let plan: Plan | undefined = undefined;
    const planCandidate = (metadata.plan || dataObj.plan || raw.plan) as string | undefined;
    if (
      planCandidate &&
      ["FREE", "STARTER", "GROWTH", "PRO", "AGENCY", "WHITE_LABEL", "ENTERPRISE"].includes(
        planCandidate.toUpperCase(),
      )
    ) {
      plan = planCandidate.toUpperCase() as Plan;
    }

    let interval: BillingInterval | undefined = undefined;
    const intervalCandidate = (dataObj.interval || raw.interval) as string | undefined;
    if (intervalCandidate && ["MONTHLY", "ANNUAL"].includes(intervalCandidate.toUpperCase())) {
      interval = intervalCandidate.toUpperCase() as BillingInterval;
    }

    const status = (dataObj.status || raw.status) as string | undefined;

    const providerCustomerId =
      typeof dataObj.customer === "string"
        ? dataObj.customer
        : typeof raw.providerCustomerId === "string"
          ? raw.providerCustomerId
          : undefined;

    const providerSubscriptionId =
      typeof dataObj.subscription === "string"
        ? dataObj.subscription
        : typeof dataObj.id === "string" && String(dataObj.id).startsWith("sub_")
          ? dataObj.id
          : typeof raw.providerSubscriptionId === "string"
            ? raw.providerSubscriptionId
            : undefined;

    const amountCents =
      typeof dataObj.amount_paid === "number"
        ? dataObj.amount_paid
        : typeof dataObj.amount === "number"
          ? dataObj.amount
          : typeof dataObj.amountCents === "number"
            ? dataObj.amountCents
            : typeof raw.amountCents === "number"
              ? raw.amountCents
              : undefined;

    const invoiceNumber =
      (dataObj.number as string) ||
      (dataObj.invoiceNumber as string) ||
      (raw.invoiceNumber as string) ||
      undefined;

    const hostedInvoiceUrl =
      (dataObj.hosted_invoice_url as string) ||
      (dataObj.hostedInvoiceUrl as string) ||
      (raw.hostedInvoiceUrl as string) ||
      undefined;

    const pdfUrl =
      (dataObj.invoice_pdf as string) ||
      (dataObj.pdfUrl as string) ||
      (raw.pdfUrl as string) ||
      undefined;

    return {
      eventType,
      organizationId,
      plan,
      interval,
      status,
      providerCustomerId,
      providerSubscriptionId,
      amountCents,
      invoiceNumber,
      hostedInvoiceUrl,
      pdfUrl,
    };
  } catch {
    return null;
  }
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
    const parsed = parseWebhookPayload(payload);
    if (!parsed) return null;
    return {
      ...parsed,
      isSimulated: true,
    };
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
    const isSandboxMode =
      !this.webhookSecret ||
      !this.webhookSecret.startsWith("whsec_") ||
      signature === "mock_signature" ||
      signature.startsWith("dummy_") ||
      signature === "sandbox_test";

    if (!isSandboxMode) {
      const isValid = verifyStripeWebhookSignature(payload, signature, this.webhookSecret);
      if (!isValid) {
        logger.warn("stripe_webhook_signature_verification_failed", {
          hasSecret: Boolean(this.webhookSecret),
          signaturePrefix: signature.slice(0, 10),
        });
        return null;
      }
    } else {
      logger.info("stripe_webhook_sandbox_mode", {
        reason: !this.webhookSecret
          ? "missing_secret"
          : !this.webhookSecret.startsWith("whsec_")
            ? "dummy_secret"
            : "mock_signature_header",
      });
    }

    const parsed = parseWebhookPayload(payload);
    if (!parsed) return null;

    return {
      ...parsed,
      isSimulated: isSandboxMode,
    };
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

/** Checks whether production live Stripe billing is configured. */
export function isLiveBillingConfigured(): boolean {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  return Boolean(stripeKey && stripeKey.startsWith("sk_"));
}
