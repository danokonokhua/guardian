import "server-only";

import { createTransport } from "nodemailer";
import type { EmailNotificationAdapter } from "@/lib/notifications";
import { serverConfig } from "@/config/server";

export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

function createSmtpMailer(): ((message: TransactionalEmail) => Promise<void>) | null {
  const config = serverConfig.server;
  if (config.smtpHost === undefined || config.mailFromEmail === undefined) {
    return null;
  }
  const hasUser = config.smtpUser !== undefined;
  const hasPassword = config.smtpPassword !== undefined;
  if (hasUser !== hasPassword) {
    console.warn("SMTP_USER and SMTP_PASSWORD must be configured together.");
    return null;
  }

  const transporter = createTransport({
    host: config.smtpHost,
    port: config.smtpPort ?? 587,
    secure: config.smtpSecure ?? (config.smtpPort ?? 587) === 465,
    ...(hasUser && hasPassword
      ? { auth: { user: config.smtpUser, pass: config.smtpPassword } }
      : {}),
  });
  const from = config.mailFromName
    ? { name: config.mailFromName, address: config.mailFromEmail }
    : config.mailFromEmail;

  return async (message) => {
    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.headers === undefined ? {} : { headers: message.headers }),
    });
  };
}

/** Sends a non-incident email, such as a local password-recovery message. */
export async function sendTransactionalEmail(message: TransactionalEmail): Promise<boolean> {
  try {
    const send = createSmtpMailer();
    if (send === null) return false;
    await send(message);
    return true;
  } catch (error) {
    console.warn("transactional_email_failed", error);
    return false;
  }
}

/**
 * Creates the operational SMTP adapter when SMTP_HOST is configured.
 * Returning null keeps local development and tests deterministic; production
 * deployments should set the complete SMTP and sender configuration.
 */
export function createSmtpEmailNotificationAdapter(): EmailNotificationAdapter | null {
  const send = createSmtpMailer();
  if (send === null) return null;

  return {
    async send(message) {
      await send({
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: { "X-Guardian-Issue": message.issueId },
      });
    },
  };
}
