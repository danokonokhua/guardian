import "./server-only-cli.cjs";

import { createSmtpEmailNotificationAdapter } from "../services/notifications/smtp";

async function main() {
  const recipient = process.argv[2];
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Supply one test recipient email address.");
  }
  const adapter = createSmtpEmailNotificationAdapter();
  if (!adapter) throw new Error("SMTP is not configured; no email was sent.");
  const reference = `guardian-test-${Date.now()}`;
  await adapter.send({
    to: recipient,
    subject: `Guardian delivery verification — ${reference}`,
    text: `This is the single Guardian test email you requested. No website outage is being reported.\n\nReference: ${reference}\n\nPlease confirm receipt and whether it arrived in Inbox or Spam.`,
    organizationId: "delivery-verification",
    issueId: reference,
  });
  process.stdout.write(
    JSON.stringify({
      status: "smtp_send_completed",
      reference,
      inboxReceipt: "awaiting recipient confirmation",
    }),
  );
}

main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "SEND_FAILED";
  const details = error as { responseCode?: number; command?: string; response?: string } | null;
  process.stderr.write(
    JSON.stringify({
      status: "failed",
      code,
      responseCode: details?.responseCode,
      command: details?.command,
      response: details?.response?.replace(/[^\s<>]+@[^\s<>]+/g, "[email]").slice(0, 500),
    }),
  );
  process.exitCode = 1;
});
