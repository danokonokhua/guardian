import { withRoute, jsonResponse } from "@/lib/api";
import { ingestWordpressWebhook } from "@/services/integrations/wordpress/service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request, { requestId }) => {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        error: "Missing or malformed Authorization header. Bearer token required.",
      },
      401,
      { "x-request-id": requestId },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const rawPayload = await request.json().catch(() => null);

  if (!rawPayload) {
    return jsonResponse(
      { error: "Invalid JSON payload in request body." },
      400,
      { "x-request-id": requestId },
    );
  }

  try {
    const result = await ingestWordpressWebhook(token, rawPayload);
    logger.info("wordpress_webhook_processed", {
      websiteId: result.websiteId,
      requestId,
    });
    return jsonResponse(result, 200, { "x-request-id": requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    const status = message.includes("Invalid") || message.includes("not recognized") ? 401 : 400;
    return jsonResponse({ error: message }, status, { "x-request-id": requestId });
  }
});
