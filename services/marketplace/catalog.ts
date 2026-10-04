export type PluginCategory = "alerting" | "telemetry" | "remediation" | "analytics" | "developer";

export interface PluginField {
  name: string;
  label: string;
  type: "text" | "password" | "url" | "select" | "number";
  placeholder?: string;
  required: boolean;
  isSecret?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string | number;
  description?: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  author: string;
  version: string;
  icon: string; // Lucide icon identifier or visual symbol
  badge?: string;
  docsUrl?: string;
  requiredPlan?: "FREE" | "GROWTH" | "PRO" | "AGENCY" | "WHITE_LABEL" | "ENTERPRISE";
  fields: PluginField[];
  webhookTemplate?: {
    method: "POST" | "PUT";
    headers: Record<string, string>;
    payloadTemplate: string;
  };
}

export const MARKETPLACE_CATALOG: MarketplacePlugin[] = [
  {
    id: "slack-notifications",
    name: "Slack Smart Incident Bot",
    description:
      "Broadcast instant incident alerts, SLA warnings, and health score recoveries directly into configured Slack channels.",
    category: "alerting",
    author: "Guardian Core",
    version: "2.1.0",
    icon: "Slack",
    badge: "Official",
    fields: [
      {
        name: "webhookUrl",
        label: "Slack Incoming Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
        isSecret: true,
        description: "Generate this from your Slack App management portal.",
      },
      {
        name: "channel",
        label: "Notification Channel",
        type: "text",
        placeholder: "#incidents-live",
        required: false,
        defaultValue: "#incidents",
      },
      {
        name: "minSeverity",
        label: "Minimum Severity",
        type: "select",
        required: true,
        defaultValue: "HIGH",
        options: [
          { label: "All Severities (INFO & up)", value: "INFO" },
          { label: "High & Critical Only", value: "HIGH" },
          { label: "Critical Outages Only", value: "CRITICAL" },
        ],
      },
    ],
    webhookTemplate: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      payloadTemplate: JSON.stringify({
        text: "🚨 *Guardian Alert*: {{incident.title}} ({{incident.severity}})",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Website*: {{website.hostname}}\n*Impact*: {{incident.impact}}\n*Action*: {{incident.recommendation}}",
            },
          },
        ],
      }),
    },
  },
  {
    id: "discord-webhook",
    name: "Discord Ops Dispatcher",
    description:
      "Rich Discord webhook embed dispatcher with color-coded severity tiers and actionable triage links.",
    category: "alerting",
    author: "Guardian Core",
    version: "1.4.0",
    icon: "MessageSquare",
    badge: "Official",
    fields: [
      {
        name: "webhookUrl",
        label: "Discord Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        required: true,
        isSecret: true,
      },
      {
        name: "mentionRole",
        label: "Role Mention ID (Optional)",
        type: "text",
        placeholder: "e.g. 1029384756",
        required: false,
      },
    ],
    webhookTemplate: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      payloadTemplate: JSON.stringify({
        content: "{{incident.severity == 'CRITICAL' ? '@here' : ''}}",
        embeds: [
          {
            title: "{{incident.title}}",
            description: "{{incident.description}}",
            color: "{{incident.severity == 'CRITICAL' ? 15158332 : 3447003}}",
            fields: [
              { name: "Website", value: "{{website.hostname}}", inline: true },
              { name: "Health Impact", value: "-{{incident.healthPenalty}} pts", inline: true },
            ],
          },
        ],
      }),
    },
  },
  {
    id: "pagerduty-sync",
    name: "PagerDuty Critical Escalation",
    description:
      "Trigger, acknowledge, and resolve high-urgency PagerDuty incidents automatically on Guardian uptime/SSL collapse.",
    category: "alerting",
    author: "Guardian Core",
    version: "2.0.1",
    icon: "BellRing",
    badge: "Partner",
    requiredPlan: "PRO",
    fields: [
      {
        name: "routingKey",
        label: "PagerDuty Integration / Routing Key",
        type: "password",
        placeholder: "32-character hexadecimal key",
        required: true,
        isSecret: true,
      },
      {
        name: "severityThreshold",
        label: "Trigger On",
        type: "select",
        required: true,
        defaultValue: "CRITICAL",
        options: [
          { label: "Critical Outages Only", value: "CRITICAL" },
          { label: "High & Critical Incidents", value: "HIGH" },
        ],
      },
    ],
  },
  {
    id: "ms-teams-connector",
    name: "Microsoft Teams Adaptive Cards",
    description:
      "Post structured Microsoft Teams Adaptive Cards with interactive drill-down buttons into your incident channel.",
    category: "alerting",
    author: "Guardian Core",
    version: "1.2.0",
    icon: "Users",
    badge: "Official",
    fields: [
      {
        name: "webhookUrl",
        label: "Teams Power Automate / Workflows Webhook URL",
        type: "url",
        placeholder: "https://outlook.office.com/webhook/...",
        required: true,
        isSecret: true,
      },
    ],
  },
  {
    id: "datadog-metrics",
    name: "Datadog Telemetry Bridge",
    description:
      "Stream website uptime, SSL days remaining, response latency, and SEO health metrics as Datadog custom metrics.",
    category: "telemetry",
    author: "Datadog Partner Network",
    version: "1.5.0",
    icon: "Activity",
    badge: "Verified",
    requiredPlan: "PRO",
    fields: [
      {
        name: "apiKey",
        label: "Datadog API Key",
        type: "password",
        placeholder: "ddp_...",
        required: true,
        isSecret: true,
      },
      {
        name: "site",
        label: "Datadog Site Region",
        type: "select",
        required: true,
        defaultValue: "datadoghq.com",
        options: [
          { label: "US1 (datadoghq.com)", value: "datadoghq.com" },
          { label: "EU (datadoghq.eu)", value: "datadoghq.eu" },
          { label: "US3 (us3.datadoghq.com)", value: "us3.datadoghq.com" },
          { label: "US5 (us5.datadoghq.com)", value: "us5.datadoghq.com" },
        ],
      },
    ],
  },
  {
    id: "cloudflare-cache-purge",
    name: "Cloudflare Edge Purge Remediation",
    description:
      "Auto-purge Cloudflare edge cache upon successful Guardian auto-remediation to instantly deploy headers and robots.txt.",
    category: "remediation",
    author: "Guardian Engineering",
    version: "1.1.0",
    icon: "CloudLightning",
    badge: "Remediation",
    requiredPlan: "GROWTH",
    fields: [
      {
        name: "apiToken",
        label: "Cloudflare API Token (Zone Cache Purge)",
        type: "password",
        placeholder: "v1.0-...",
        required: true,
        isSecret: true,
      },
      {
        name: "zoneId",
        label: "Cloudflare Zone ID",
        type: "text",
        placeholder: "32-character zone hex ID",
        required: true,
      },
    ],
  },
  {
    id: "github-issues-bridge",
    name: "GitHub Issues Auto-Sync",
    description:
      "Automatically file GitHub issues in your repository when critical SEO regressions or broken links are detected.",
    category: "developer",
    author: "Guardian Community",
    version: "1.0.4",
    icon: "GitBranch",
    badge: "Community",
    fields: [
      {
        name: "githubToken",
        label: "GitHub Personal Access Token (repo scope)",
        type: "password",
        placeholder: "ghp_...",
        required: true,
        isSecret: true,
      },
      {
        name: "repository",
        label: "Repository (owner/repo)",
        type: "text",
        placeholder: "acme-corp/marketing-site",
        required: true,
      },
      {
        name: "labels",
        label: "Default Issue Labels (comma separated)",
        type: "text",
        defaultValue: "bug, guardian, automated",
        required: false,
      },
    ],
  },
  {
    id: "generic-signed-webhook",
    name: "Generic Signed Webhook Stream",
    description:
      "Real-time JSON webhook stream signed with HMAC-SHA256 for custom microservices, Zapier, or n8n automation pipelines.",
    category: "developer",
    author: "Guardian Core",
    version: "3.0.0",
    icon: "Webhook",
    badge: "Core",
    fields: [
      {
        name: "targetUrl",
        label: "Outbound Webhook URL",
        type: "url",
        placeholder: "https://api.yourdomain.com/webhooks/guardian",
        required: true,
      },
      {
        name: "signingSecret",
        label: "HMAC Signing Secret",
        type: "password",
        placeholder: "Custom secret or generated token",
        required: false,
        isSecret: true,
      },
    ],
  },
];

export function getPluginById(pluginId: string): MarketplacePlugin | undefined {
  return MARKETPLACE_CATALOG.find((p) => p.id === pluginId);
}
