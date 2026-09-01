import "server-only";

import { serverConfig } from "@/config/server";
import {
  createWebhookReportingDestination,
  type ReportingDestination,
} from "@/services/reporting/adapters";

/** Returns the configured webhook destination, or undefined when not enabled. */
export function getConfiguredReportingDestination(): ReportingDestination | undefined {
  const url = serverConfig.server.reportingWebhookUrl;
  const secret = serverConfig.server.reportingWebhookSecret;
  if (url === undefined || secret === undefined) return undefined;
  return createWebhookReportingDestination({ url, signingSecret: secret });
}
