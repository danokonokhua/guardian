import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const outbound = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({
  requestSafeOutbound: outbound,
  resolveSafeOutboundUrl: resolve,
}));
import {
  destinationUrl,
  destinationPayload,
  sendDestination,
  validateDestination,
  type ExternalMessage,
} from "@/lib/notification-destinations/transport";
import { encryptDestination, decryptDestination } from "@/lib/notification-destinations/secrets";
const message: ExternalMessage = {
  deliveryId: "delivery-1",
  organizationId: "org-1",
  issueId: "issue-1",
  title: "Alert <!channel> @everyone",
  body: "Review incident",
  severity: "HIGH",
  test: false,
  createdAt: "2026-09-28T00:00:00Z",
};
beforeEach(() => {
  outbound.mockReset();
  resolve.mockReset();
  vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  "http://example.com/hook",
  "https://user:secret@example.com/hook",
  "https://example.com:8443/hook",
  "https://example.com/hook#secret",
])("rejects unsafe URL shape %s", (url) => expect(() => destinationUrl("WEBHOOK", url)).toThrow());
it("validates provider URL ownership and exact host boundaries", () => {
  expect(destinationUrl("SLACK", "https://hooks.slack.com/services/T1/B1/secret").hostname).toBe(
    "hooks.slack.com",
  );
  for (const value of [
    "https://hooks.slack.com.evil.test/services/T/B/secret",
    "https://evil.test/services/T/B/secret",
  ])
    expect(() => destinationUrl("SLACK", value)).toThrow();
  expect(
    destinationUrl("DISCORD", "https://discord.com/api/webhooks/123/token").searchParams.get(
      "wait",
    ),
  ).toBe("true");
  expect(() =>
    destinationUrl("DISCORD", "https://discord.com/api/webhooks/123/token?evil=x"),
  ).toThrow();
  expect(
    destinationUrl(
      "TEAMS",
      "https://prod-1.westus.logic.azure.com/workflows/id/triggers/manual/paths/invoke?sig=secret",
    ).protocol,
  ).toBe("https:");
  expect(() => destinationUrl("TEAMS", "https://foo.webhook.office.com/legacy")).toThrow();
});
it("requires a public address at destination creation", async () => {
  resolve.mockRejectedValue(Error("private address: secret-url"));
  await expect(validateDestination("WEBHOOK", "https://private.example/hook")).rejects.toThrow(
    "Destination must resolve to public addresses.",
  );
});
it("encrypts with tenant/destination binding and never stores plaintext", () => {
  const value = { url: "https://example.com/secret-hook", signingSecret: "private-signing-secret" };
  const encrypted = encryptDestination(value, "org:destination");
  expect(encrypted).not.toContain("secret-hook");
  expect(decryptDestination(encrypted, "org:destination")).toEqual(value);
  expect(() => decryptDestination(encrypted, "other:destination")).toThrow();
  expect(() => decryptDestination(encrypted.slice(0, -5) + "AAAAA", "org:destination")).toThrow();
});
it("uses plain Slack text, disables Discord mentions, and formats Teams adaptive cards", () => {
  expect(destinationPayload("SLACK", message)).toMatchObject({
    blocks: [{ text: { type: "plain_text" } }],
  });
  expect(JSON.stringify(destinationPayload("SLACK", message))).toContain("&lt;!channel&gt;");
  expect(destinationPayload("DISCORD", message)).toMatchObject({ allowed_mentions: { parse: [] } });
  expect(destinationPayload("TEAMS", message)).toMatchObject({
    attachments: [
      { contentType: "application/vnd.microsoft.card.adaptive", content: { type: "AdaptiveCard" } },
    ],
  });
});
it("signs the exact webhook body and supplies a stable idempotency key", async () => {
  outbound.mockResolvedValue({ ok: true, status: 204 });
  const credentials = { url: "https://example.com/hook", signingSecret: "a".repeat(32) };
  expect((await sendDestination("WEBHOOK", credentials, message)).ok).toBe(true);
  const options = outbound.mock.calls[0]![1];
  expect(options.method).toBe("POST");
  expect(options.headers["idempotency-key"]).toBe(message.deliveryId);
  expect(options.headers["x-guardian-signature"]).toBe(
    "sha256=" +
      createHmac("sha256", credentials.signingSecret)
        .update(`${options.headers["x-guardian-timestamp"]}.${options.body}`)
        .digest("hex"),
  );
});
it.each([
  [400, false],
  [403, false],
  [302, false],
  [408, true],
  [429, true],
  [500, true],
])("classifies HTTP %i retries", async (status, retryable) => {
  outbound.mockResolvedValue({ ok: false, status, headers: { "retry-after": "75" } });
  expect(
    await sendDestination(
      "WEBHOOK",
      { url: "https://example.com/hook", signingSecret: "a".repeat(32) },
      message,
    ),
  ).toMatchObject({ retryable, retryAfter: 75, status });
});
it("does not leak provider errors or accept non-ok Slack responses", async () => {
  outbound.mockRejectedValue(Error("token=supersecret"));
  expect(
    JSON.stringify(
      await sendDestination(
        "SLACK",
        { url: "https://hooks.slack.com/services/T/B/secret" },
        message,
      ),
    ),
  ).not.toContain("supersecret");
  outbound.mockResolvedValue({ ok: true, status: 200, text: async () => "invalid_payload" });
  expect(
    (
      await sendDestination(
        "SLACK",
        { url: "https://hooks.slack.com/services/T/B/secret" },
        message,
      )
    ).ok,
  ).toBe(false);
});
