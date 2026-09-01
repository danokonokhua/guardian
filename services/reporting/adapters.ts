import { createHmac } from "node:crypto";

export interface AnalyticsReport {
  organizationId: string;
  format: "csv" | "json";
  content: string;
  generatedAt: string;
}

export interface ReportingDestination {
  deliver(report: AnalyticsReport): Promise<void>;
}

export interface WebhookTransport {
  send(url: string, init: RequestInit): Promise<Response>;
}

const defaultTransport: WebhookTransport = {
  send: (url, init) => fetch(url, init),
};

/** Creates a signed webhook destination; callers provide job-level retries. */
export function createWebhookReportingDestination(options: {
  url: string;
  signingSecret: string;
  transport?: WebhookTransport;
}): ReportingDestination {
  const parsed = new URL(options.url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Reporting webhook URL must use http or https.");
  }
  const transport = options.transport ?? defaultTransport;
  return {
    async deliver(report) {
      const body = JSON.stringify(report);
      const signature = createHmac("sha256", options.signingSecret).update(body).digest("hex");
      const response = await transport.send(options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "guardian-reporting/1",
          "x-guardian-signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Reporting webhook returned HTTP ${response.status}.`);
    },
  };
}
