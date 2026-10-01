import { describe, it, expect } from "vitest";
import { MockBillingProvider, getBillingProvider } from "@/services/billing/provider";

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

  it("handles incoming webhook events gracefully", async () => {
    const provider = new MockBillingProvider();
    const payload = JSON.stringify({
      type: "customer.subscription.created",
      data: {
        object: {
          metadata: { organizationId: "org-456" },
        },
      },
    });

    const event = await provider.handleWebhook(payload, "test-signature");
    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("customer.subscription.created");
    expect(event?.organizationId).toBe("org-456");
  });
});
