import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/services/notifications/smtp", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "@/app/api/contact/route";

function request(payload: unknown) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendTransactionalEmail.mockResolvedValue({ id: "mock-email-id" });
  });

  it("successfully processes valid contact submission and notifies sales", async () => {
    const res = await POST(
      request({
        name: "Alice Smith",
        email: "alice@acme.inc",
        company: "Acme Corporation",
        website: "https://acme.inc",
        plan: "Enterprise Custom Plan",
        message: "We need custom uptime SLA and multi-region monitoring for 50 properties.",
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("24 hours");
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "sales@useguardian.io",
        subject: expect.stringContaining("Alice Smith"),
      }),
    );
  });

  it("rejects request when email is invalid", async () => {
    const res = await POST(
      request({
        name: "Alice",
        email: "not-an-email",
        message: "Testing message",
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Please provide a valid email address");
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("rejects request when message is too short", async () => {
    const res = await POST(
      request({
        name: "Alice",
        email: "alice@example.com",
        message: "Hi",
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Message must be at least 5 characters");
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
