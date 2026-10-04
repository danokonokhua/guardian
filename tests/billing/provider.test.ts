import { describe, it, expect } from "vitest";
import {
  MockBillingProvider,
  StripeBillingProvider,
  getBillingProvider,
  verifyStripeWebhookSignature,
  generateStripeSignature,
  parseWebhookPayload,
} from "@/services/billing/provider";

describe("Billing Provider Service", () => {
  it("resolves default MockBillingProvider when Stripe key is not configured", () => {
    const provider = getBillingProvider();
    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(MockBillingProvider);
  });

  it("creates deterministic checkout sessions in mock mode", async () => {
    const provider = new MockBillingProvider();
    const result = await provider.createCheckoutSession({
      organizationId: "org-123",
      plan: "PRO",
      interval: "MONTHLY",
      successUrl: "http://localhost:3000/billing?success=true",
      cancelUrl: "http://localhost:3000/billing?cancel=true",
    });

    expect(result.sessionId).toContain("mock_session_");
    expect(result.url).toContain("mock_checkout=true");
    expect(result.url).toContain("plan=PRO");
  });

  it("creates customer portal sessions in mock mode", async () => {
    const provider = new MockBillingProvider();
    const result = await provider.createCustomerPortalSession({
      organizationId: "org-123",
      returnUrl: "http://localhost:3000/billing",
    });

    expect(result.url).toContain("mock_portal=true");
  });

  it("handles incoming webhook events gracefully in mock mode", async () => {
    const provider = new MockBillingProvider();
    const payload = JSON.stringify({
      type: "customer.subscription.created",
      data: {
        object: {
          metadata: { organizationId: "org-456", plan: "GROWTH" },
          status: "active",
        },
      },
    });

    const event = await provider.handleWebhook(payload, "test-signature");
    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("customer.subscription.created");
    expect(event?.organizationId).toBe("org-456");
    expect(event?.plan).toBe("GROWTH");
    expect(event?.isSimulated).toBe(true);
  });

  describe("Stripe Webhook Signature Verification", () => {
    const secret = "whsec_test_secret_key_1234567890abcdef";
    const samplePayload = JSON.stringify({
      id: "evt_123",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          organizationId: "org-xyz",
          amount_paid: 5900,
          number: "INV-2026-001",
        },
      },
    });

    it("verifies valid HMAC-SHA256 signature generated with matching secret", () => {
      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = generateStripeSignature(samplePayload, secret, now);
      const isValid = verifyStripeWebhookSignature(samplePayload, signatureHeader, secret);
      expect(isValid).toBe(true);
    });

    it("rejects tampered payload with otherwise valid signature header", () => {
      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = generateStripeSignature(samplePayload, secret, now);
      const tamperedPayload = samplePayload.replace("5900", "9999");
      const isValid = verifyStripeWebhookSignature(tamperedPayload, signatureHeader, secret);
      expect(isValid).toBe(false);
    });

    it("rejects incorrect webhook secret", () => {
      const now = Math.floor(Date.now() / 1000);
      const signatureHeader = generateStripeSignature(samplePayload, secret, now);
      const isValid = verifyStripeWebhookSignature(
        samplePayload,
        signatureHeader,
        "whsec_wrong_secret",
      );
      expect(isValid).toBe(false);
    });

    it("rejects expired timestamp beyond tolerance window", () => {
      const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
      const signatureHeader = generateStripeSignature(samplePayload, secret, tenMinutesAgo);
      const isValid = verifyStripeWebhookSignature(samplePayload, signatureHeader, secret, 300);
      expect(isValid).toBe(false);
    });

    it("accepts signature within tolerance window", () => {
      const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
      const signatureHeader = generateStripeSignature(samplePayload, secret, twoMinutesAgo);
      const isValid = verifyStripeWebhookSignature(samplePayload, signatureHeader, secret, 300);
      expect(isValid).toBe(true);
    });
  });

  describe("StripeBillingProvider Dual-Mode & Sandbox Behavior", () => {
    const liveSecret = "whsec_live_key_99999999";
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_real_123",
          customer: "cus_real_123",
          status: "active",
          metadata: { organizationId: "org-live-1", plan: "PRO" },
        },
      },
    });

    it("verifies real signature and returns isSimulated: false when live secret configured", async () => {
      const provider = new StripeBillingProvider("sk_live_123", liveSecret);
      const header = generateStripeSignature(payload, liveSecret);
      const result = await provider.handleWebhook(payload, header);

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe("org-live-1");
      expect(result?.plan).toBe("PRO");
      expect(result?.isSimulated).toBe(false);
    });

    it("rejects invalid signature when live secret configured", async () => {
      const provider = new StripeBillingProvider("sk_live_123", liveSecret);
      const result = await provider.handleWebhook(payload, "t=123,v1=invalid_signature");
      expect(result).toBeNull();
    });

    it("allows sandbox mock_signature even when live secret configured", async () => {
      const provider = new StripeBillingProvider("sk_live_123", liveSecret);
      const result = await provider.handleWebhook(payload, "mock_signature");

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe("org-live-1");
      expect(result?.plan).toBe("PRO");
      expect(result?.isSimulated).toBe(true);
    });

    it("automatically operates in sandbox mode when webhook secret is missing", async () => {
      const provider = new StripeBillingProvider("sk_live_123", "");
      const result = await provider.handleWebhook(payload, "any_dummy_sig");

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe("org-live-1");
      expect(result?.isSimulated).toBe(true);
    });

    it("automatically operates in sandbox mode when webhook secret is dummy", async () => {
      const provider = new StripeBillingProvider("sk_live_123", "dummy_webhook_secret");
      const result = await provider.handleWebhook(payload, "dummy_sig");

      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe("org-live-1");
      expect(result?.isSimulated).toBe(true);
    });

    it("parses rich invoice webhook data correctly", () => {
      const invoicePayload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            customer: "cus_999",
            amount_paid: 5900,
            number: "INV-2026-888",
            hosted_invoice_url: "https://stripe.com/invoice/888",
            invoice_pdf: "https://stripe.com/invoice/888.pdf",
            metadata: { organizationId: "org-inv-1", plan: "PRO" },
          },
        },
      });

      const parsed = parseWebhookPayload(invoicePayload);
      expect(parsed).not.toBeNull();
      expect(parsed?.organizationId).toBe("org-inv-1");
      expect(parsed?.amountCents).toBe(5900);
      expect(parsed?.invoiceNumber).toBe("INV-2026-888");
      expect(parsed?.hostedInvoiceUrl).toBe("https://stripe.com/invoice/888");
      expect(parsed?.pdfUrl).toBe("https://stripe.com/invoice/888.pdf");
      expect(parsed?.plan).toBe("PRO");
    });
  });
});
