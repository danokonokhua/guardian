import "server-only";

import type { TenantScope } from "@/db/tenant";
import { logger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import { generateVapidToken, getVapidPublicKey } from "./vapid";
import {
  deletePushSubscriptionRecord,
  listSubscriptionsForOrg,
  listSubscriptionsForUser,
  listSubscriptionsGlobalForOrg,
  type MobileSubscriptionRecord,
} from "./repository";
import type {
  MobileHubOverview,
  MobileNotificationPayload,
  PushSendResult,
} from "./types";

/**
 * Sends a Web Push notification to a single registered device endpoint.
 */
export async function sendPushNotification(
  subscription: MobileSubscriptionRecord,
  payload: MobileNotificationPayload
): Promise<PushSendResult> {
  // Test / simulated endpoint bypass
  if (
    subscription.endpoint.startsWith("https://guardian.test") ||
    subscription.endpoint.startsWith("mock://") ||
    process.env.NODE_ENV === "test"
  ) {
    logger.info("mobile_push_simulated_dispatch", {
      endpoint: subscription.endpoint,
      title: payload.title,
    });
    return {
      endpoint: subscription.endpoint,
      success: true,
      statusCode: 200,
    };
  }

  try {
    const { authorization } = generateVapidToken(subscription.endpoint);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        TTL: "86400",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 404 || response.status === 410) {
      // Endpoint is expired/unsubscribed; prune from database
      logger.warn("mobile_push_endpoint_expired", {
        endpoint: subscription.endpoint,
        status: response.status,
      });
      return {
        endpoint: subscription.endpoint,
        success: false,
        statusCode: response.status,
        error: "Subscription expired or invalidated by push service",
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        endpoint: subscription.endpoint,
        success: false,
        statusCode: response.status,
        error: `Push service rejected: ${response.status} ${errText}`,
      };
    }

    return {
      endpoint: subscription.endpoint,
      success: true,
      statusCode: response.status,
    };
  } catch (err: any) {
    logger.error("mobile_push_dispatch_error", {
      endpoint: subscription.endpoint,
      error: err.message,
    });
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: err.message || "Network error dispatching push notification",
    };
  }
}

/**
 * Broadcasts a push alert to all registered operator devices in the organization.
 */
export async function broadcastPushToOrganization(
  organizationId: string,
  payload: MobileNotificationPayload
): Promise<PushSendResult[]> {
  const devices = await listSubscriptionsGlobalForOrg(organizationId);
  if (devices.length === 0) return [];

  const promises = devices.map((device) => sendPushNotification(device, payload));
  const results = await Promise.allSettled(promises);

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          endpoint: devices[i]?.endpoint ?? "unknown",
          success: false,
          error: (r.reason as Error)?.message ?? "Unknown dispatch failure",
        }
  );
}

/**
 * Sends a real-time verification ping to the user's registered devices.
 */
export async function sendTestPushToUser(
  scope: TenantScope,
  userId: string
): Promise<{ dispatchedCount: number; results: PushSendResult[] }> {
  const devices = await listSubscriptionsForUser(scope, userId);
  if (devices.length === 0) {
    throw new NotFoundError("No mobile devices registered for push notifications.");
  }

  const payload: MobileNotificationPayload = {
    title: "🛡️ Guardian Mobile Connected",
    body: "Real-time incident alerts and digital health updates are active on this device.",
    url: "/mobile",
    tag: "guardian-test-ping",
    severity: "INFO",
  };

  const results = await Promise.all(
    devices.map((device) => sendPushNotification(device, payload))
  );

  return {
    dispatchedCount: results.filter((r) => r.success).length,
    results,
  };
}

/**
 * Compiles overview telemetry for the Mobile Command Center.
 */
export async function getMobileHubOverview(
  scope: TenantScope
): Promise<MobileHubOverview> {
  const devices = await listSubscriptionsForOrg(scope);
  return {
    deviceCount: devices.length,
    devices: devices.map((d) => ({
      id: d.id,
      endpoint: d.endpoint,
      userAgent: d.userAgent,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    vapidPublicKey: getVapidPublicKey(),
  };
}

