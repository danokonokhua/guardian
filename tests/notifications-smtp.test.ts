import { describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "m1" });
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock("nodemailer", () => ({ createTransport }));
vi.mock("@/config/server", () => ({
  serverConfig: {
    server: {
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpUser: "smtp-user",
      smtpPassword: "smtp-password",
      smtpSecure: false,
      mailFromEmail: "alerts@example.test",
      mailFromName: "Guardian Alerts",
    },
  },
}));

import { createSmtpEmailNotificationAdapter } from "@/services/notifications/smtp";

describe("SMTP notification adapter", () => {
  it("configures authenticated TLS-capable SMTP and sends a message", async () => {
    const adapter = createSmtpEmailNotificationAdapter();
    expect(adapter).not.toBeNull();
    await adapter!.send({
      to: "owner@example.test",
      subject: "SLA breach",
      text: "An issue needs attention.",
      organizationId: "org-1",
      issueId: "issue-1",
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "smtp-user", pass: "smtp-password" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "Guardian Alerts", address: "alerts@example.test" },
      to: "owner@example.test",
      subject: "SLA breach",
      text: "An issue needs attention.",
      headers: { "X-Guardian-Issue": "issue-1" },
    });
  });
});
