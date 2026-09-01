import { loadConfig } from "@/config/env";
import {
  createWebhookReportingDestination,
  type ReportingDestination,
} from "@/services/reporting/adapters";

/** Returns the configured webhook destination, or undefined when not enabled. */
export function getConfiguredReportingDestination(): ReportingDestination | undefined {
  const config = loadConfig();
  const url = config.server.reportingWebhookUrl;
  const secret = config.server.reportingWebhookSecret;
  if (url === undefined || secret === undefined) return undefined;
  return createWebhookReportingDestination({ url, signingSecret: secret });
}
