import "server-only";

import { createTransport } from "nodemailer";
import type { EmailNotificationAdapter } from "@/lib/notifications";
import { serverConfig } from "@/config/server";

/**
 * Creates the operational SMTP adapter when SMTP_HOST is configured.
 * Returning null keeps local development and tests deterministic; production
 * deployments should set the complete SMTP and sender configuration.
 */
export function createSmtpEmailNotificationAdapter(): EmailNotificationAdapter | null {
  const config = serverConfig.server;
  if (config.smtpHost === undefined) {
    if (serverConfig.isProduction) {
      throw new Error("SMTP_HOST is required for production email notifications.");
    }
    return null;
  }

  if (config.mailFromEmail === undefined) {
    throw new Error("MAIL_FROM_EMAIL is required when SMTP_HOST is configured.");
  }
  const hasUser = config.smtpUser !== undefined;
  const hasPassword = config.smtpPassword !== undefined;
  if (hasUser !== hasPassword) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
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

  return {
    async send(message) {
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: { "X-Guardian-Issue": message.issueId },
      });
    },
  };
}
