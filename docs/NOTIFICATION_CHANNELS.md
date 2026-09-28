# Organization notification channels

Implemented 28 September 2026: Slack incoming webhooks, Microsoft Teams Workflows, Discord incoming webhooks and signed HTTPS webhooks. Organization owners and admins manage up to 20 destinations in **Settings > Alerts > Organization destinations**. Personal email and in-app preferences remain separate.

## Activate a destination

1. Obtain a webhook URL from the provider using the instructions below. Treat the entire URL as a password.
2. Enter a descriptive name, choose the service and paste its URL. Generic webhooks also require a shared signing secret of 32–256 characters; use a randomly generated value.
3. Save. New destinations are paused, so saving does not send a message.
4. Choose **Send test**, then **Refresh delivery status**. Confirm receipt in the actual target channel or receiver logs before enabling incident alerts. Tests are allowed while paused, limited to one request per destination per calendar minute.
5. Choose **Enable**. Use **Pause** to stop new incident deliveries. A request already in flight cannot be recalled. Removing a destination also deletes its delivery history.

The latest five delivery records show status, attempt count and HTTP result. `DELIVERED` means the endpoint accepted the request; it does not guarantee a person received or read it. Teams can accept a workflow request before the downstream channel-posting step runs.

### Slack

Create or select a Slack app, enable Incoming Webhooks, and add a webhook to the intended workspace/channel. Copy the resulting `https://hooks.slack.com/services/...` URL. Guardian also accepts `hooks.slack-gov.com`. Workspace approval may be required. Guardian sends plain-text blocks and disables link previews. See [Slack's incoming webhook guide](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

### Microsoft Teams

Use Teams **Workflows** to create a webhook-triggered flow that posts a message/card to the intended channel. Select the anonymous/Anyone trigger option because Guardian uses the secret URL rather than a Microsoft user token. Save and copy the generated workflow URL. Guardian supports the Logic Apps and Power Platform workflow URL forms; legacy Office connector URLs are not supported. Keep a maintained flow owner and add co-owners where appropriate so it does not become orphaned. Check workflow run history if Guardian reports HTTP 202 but no channel message appears. See [Microsoft's Workflows setup guide](https://support.microsoft.com/en-us/workflows/send-messages-in-teams-using-incoming-webhooks) and [incoming webhook documentation](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook).

### Discord

Create an incoming webhook in the intended channel's integration settings and copy its `https://discord.com/api/webhooks/...` URL. Guardian uses `wait=true` to request confirmation and suppresses mentions and link embeds. A numeric `thread_id` query parameter is supported for an existing thread; Guardian does not create forum threads. See [Discord's webhook API](https://docs.discord.com/developers/resources/webhook).

### Generic HTTPS receiver

Expose a public HTTPS endpoint on port 443 that accepts JSON POST requests and returns 2xx after durably accepting the event. Redirects are not followed; private, loopback and metadata addresses are blocked, including after DNS changes. Requests time out after eight seconds and response bodies are bounded to 64 KiB.

The JSON envelope contains `version: 1`, `event` (`guardian.test` or `guardian.issue`), `deliveryId`, `organizationId`, nullable `issueId`, `title`, `body`, `severity`, `test`, and ISO `createdAt`. Titles are truncated to 200 characters and bodies to 1,500. Headers include:

- `Idempotency-Key` and `X-Guardian-Delivery-Id`: stable delivery UUID across retries.
- `X-Guardian-Timestamp`: Unix seconds for this attempt.
- `X-Guardian-Signature`: `sha256=` followed by the hexadecimal HMAC-SHA256 of `timestamp + "." + rawBody`, using the shared signing secret.

Verify the raw request bytes before parsing JSON, reject old timestamps and deduplicate delivery IDs durably. For a Node receiver, the signature check can use:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGuardian(
  rawBody: Buffer,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^\d+$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(rawBody)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
```

Apply a request-size limit, require verification before processing, and return success for an already accepted delivery ID. The timestamp is refreshed on retry; `createdAt` is the original event time. Exactly-once external delivery is not guaranteed.

## Alert and retry behavior

Enabled destinations receive existing SLA escalations once per issue/destination in each five-minute clock window, independent of the number of organization members. Domain-expiry threshold events use their existing renewal-aware deduplication ledger. This is not a rolling five-minute limit: events on adjacent window boundaries can be close together. Recovery messages and per-destination severity filters are not included in this slice.

Delivery records and queue jobs commit together. Workers recheck organization ownership, destination state and incident status. Paused destinations and resolved/ignored/deleted incidents cancel pending incident deliveries. Explicit test messages have no incident and can run while paused.

Network failures, HTTP 408, 429 and 5xx retry, up to five attempts. Default delays are 30, 60, 120 and 240 seconds; longer `Retry-After` values are respected up to one hour. A requested delay above one hour becomes a visible failure. Other non-2xx responses, including redirects, fail without automatic retry. Slack additionally must return `ok`. Generic receivers should deduplicate because a response lost after successful acceptance can cause another attempt.

## Deployment and credentials

Apply migration `202609280003_external_notifications`, generate Prisma, then deploy both web and worker. Configure the same `NOTIFICATION_ENCRYPTION_KEY` in both processes: base64-encoded 32 random bytes. Generate it once using the command in `.env.example`, store it in the deployment secret manager, and back it up securely. The local ignored `.env` has been configured; it must not be committed.

URLs and signing secrets use authenticated AES-256-GCM encryption bound to the organization and destination ID. API responses expose the hostname only. Tenant row-level security and owner/admin authorization protect settings; webhook connections use DNS-pinned public addresses.

Do not casually replace the encryption key: existing credentials will stop decrypting. There is no automatic key-rotation migration in this slice. To rotate a destination credential, remove and recreate that destination. To change the server encryption key, pause destinations, securely retain their provider setup details, remove them, deploy the new shared key, then recreate/test/enable them. Removing destinations removes their history.

## Verification and limits

Unit tests cover payloads, signature construction, URL validation, encryption, authorization, retry classification and SLA fanout. An opt-in real PostgreSQL/pg-boss test covers atomic insertion, concurrency/deduplication, retry cooldown, exhaustion, worker consumption, pause cancellation, tenant isolation and deletion. Its outbound transport is mocked; it sends no provider messages.

Run `DESTINATIONS_LIVE_TEST=1` with `.env` loaded for `tests/jobs/external-notifications.integration.test.ts`. Existing domain-expiry and email-health integration tests also pass. Chromium desktop (1440×1000), tablet (768×1024) and mobile (390×844) checks cover creation, encrypted persistence, enable/pause, delivery failure history, deletion and responsive layout. Test fixtures are removed afterward. Long section screenshots include the fixed bottom navigation at the original viewport boundary; viewport captures show the usable form separately.

Real Slack, Teams, Discord and customer webhook delivery still needs the intended destination URLs and an explicit test through Settings. No external provider messages were sent during implementation. The separate SMTP quota restriction remains unresolved. Billing stays paused; agency/client status pages are next in the PRD.
