import "server-only";
import { createHmac } from "node:crypto";
import { ValidationError } from "@/lib/errors";
import { requestSafeOutbound, resolveSafeOutboundUrl } from "@/lib/security/outbound-url";
import type { DestinationChannel } from "./config";

export function destinationUrl(channel: DestinationChannel, raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("Enter a valid HTTPS destination URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new ValidationError(
      "Destinations require HTTPS on port 443 without credentials or fragments.",
    );
  const host = url.hostname;
  if (
    channel === "SLACK" &&
    (!(host === "hooks.slack.com" || host === "hooks.slack-gov.com") ||
      !/^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname) ||
      url.search)
  )
    throw new ValidationError("Use a Slack incoming webhook URL.");
  if (channel === "DISCORD") {
    if (
      host !== "discord.com" ||
      !/^\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(url.pathname) ||
      [...url.searchParams.keys()].some((k) => !["wait", "thread_id"].includes(k)) ||
      (url.searchParams.has("thread_id") && !/^\d+$/.test(url.searchParams.get("thread_id")!))
    )
      throw new ValidationError("Use a Discord channel incoming webhook URL.");
    url.searchParams.set("wait", "true");
  }
  if (
    channel === "TEAMS" &&
    !(
      (host.endsWith(".logic.azure.com") && url.pathname.includes("/workflows/")) ||
      (host.endsWith(".environment.api.powerplatform.com") &&
        url.pathname.includes("/powerautomate/automations/direct/workflows/"))
    )
  )
    throw new ValidationError(
      "Use a Microsoft Teams Workflows webhook URL (anonymous webhook trigger).",
    );
  return url;
}
export async function validateDestination(channel: DestinationChannel, raw: string) {
  const url = destinationUrl(channel, raw);
  try {
    await resolveSafeOutboundUrl(url.href);
  } catch {
    throw new ValidationError("Destination must resolve to public addresses.");
  }
  return url;
}
export type ExternalMessage = {
  deliveryId: string;
  organizationId: string;
  issueId: string | null;
  title: string;
  body: string;
  severity: string;
  test: boolean;
  createdAt: string;
};
export function destinationPayload(channel: DestinationChannel, message: ExternalMessage) {
  const title = message.title.slice(0, 200),
    body = message.body.slice(0, 1500);
  if (channel === "SLACK")
    return {
      text: `${title}\n${body}`.replace(
        /[&<>]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
      ),
      blocks: [{ type: "section", text: { type: "plain_text", text: `${title}\n${body}` } }],
      unfurl_links: false,
      unfurl_media: false,
    };
  if (channel === "DISCORD")
    return {
      content: `${title}\n${body}`.slice(0, 1900),
      allowed_mentions: { parse: [] },
      flags: 4,
    };
  if (channel === "TEAMS")
    return {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              { type: "TextBlock", text: title, weight: "Bolder", wrap: true },
              { type: "TextBlock", text: body, wrap: true },
            ],
          },
        },
      ],
    };
  return {
    version: 1,
    event: message.test ? "guardian.test" : "guardian.issue",
    ...message,
    title,
    body,
  };
}
export type SendResult = {
  ok: boolean;
  retryable: boolean;
  status?: number;
  retryAfter?: number;
  error?: string;
};
export async function sendDestination(
  channel: DestinationChannel,
  credentials: { url: string; signingSecret?: string },
  message: ExternalMessage,
): Promise<SendResult> {
  try {
    const url = destinationUrl(channel, credentials.url);
    const body = JSON.stringify(destinationPayload(channel, message));
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key": message.deliveryId,
      "x-guardian-delivery-id": message.deliveryId,
    };
    if (channel === "WEBHOOK") {
      if (!credentials.signingSecret)
        return { ok: false, retryable: false, error: "Webhook signing secret is missing." };
      const timestamp = String(Math.floor(Date.now() / 1000));
      headers["x-guardian-timestamp"] = timestamp;
      headers["x-guardian-signature"] =
        "sha256=" +
        createHmac("sha256", credentials.signingSecret)
          .update(`${timestamp}.${body}`)
          .digest("hex");
    }
    const response = await requestSafeOutbound(url.href, {
      method: "POST",
      headers,
      body,
      timeoutMs: 8000,
      maxBodyBytes: 65536,
    });
    if (response.ok) {
      if (channel === "SLACK" && (await response.text()).trim() !== "ok")
        return {
          ok: false,
          retryable: false,
          status: response.status,
          error: "Slack did not acknowledge the message.",
        };
      return { ok: true, retryable: false, status: response.status };
    }
    const retryable = [408, 429].includes(response.status) || response.status >= 500;
    const retryHeader = response.headers?.["retry-after"];
    const seconds = retryHeader
      ? /^\d+$/.test(retryHeader)
        ? Number(retryHeader)
        : Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)
      : 0;
    return {
      ok: false,
      retryable: retryable && !(seconds > 3600),
      status: response.status,
      ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfter: seconds } : {}),
      error: `Destination returned HTTP ${response.status}.`,
    };
  } catch {
    return { ok: false, retryable: true, error: "Destination could not be reached securely." };
  }
}
