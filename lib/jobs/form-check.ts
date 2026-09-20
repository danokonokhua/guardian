import "server-only";

import { performance } from "node:perf_hooks";

import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";
import { requestSafeOutbound } from "@/lib/security/outbound-url";

export const FORM_TIMEOUT_MS = 10_000;
export const FORM_PAGE_MAX_BODY_BYTES = 256 * 1024;
export const FORM_MAX_PATH_LENGTH = 256;
export const FORM_MAX_ID_LENGTH = 128;

const SAFE_FORM_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

type FormConfig = {
  formId: string;
  pagePath?: string;
  probePath?: string;
};

type ParsedForm = {
  method: "GET" | "POST";
  action: URL;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attributeValue(tag: string, attribute: string): string | null {
  const expression = new RegExp(
    `(?:^|\\s)${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`,
    "i",
  );
  const match = expression.exec(tag);
  return decodeHtml((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim()) || null;
}

function safeRelativePath(value: unknown): string | null {
  if (value === undefined) return "/";
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > FORM_MAX_PATH_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[?#\s]/.test(value)
  ) {
    return null;
  }
  try {
    const parsed = new URL(value, "https://guardian.invalid");
    return parsed.origin === "https://guardian.invalid" && parsed.username === ""
      ? parsed.pathname
      : null;
  } catch {
    return null;
  }
}

function parseFormConfig(config: unknown): FormConfig | null {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return null;
  const value = config as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["formId", "pagePath", "probePath"].includes(key))) {
    return null;
  }
  const formId = value.formId;
  if (
    typeof formId !== "string" ||
    formId.length === 0 ||
    formId.length > FORM_MAX_ID_LENGTH ||
    !SAFE_FORM_ID.test(formId)
  ) {
    return null;
  }
  const pagePath = safeRelativePath(value.pagePath);
  const probePath = safeRelativePath(value.probePath);
  if (pagePath === null || (value.probePath !== undefined && probePath === null)) return null;
  return {
    formId,
    ...(pagePath === "/" && value.pagePath === undefined ? {} : { pagePath }),
    ...(probePath === null || (probePath === "/" && value.probePath === undefined)
      ? {}
      : { probePath }),
  };
}

function failure(
  startedAt: number,
  status: "DOWN" | "ERROR",
  failureClass: string,
  summary: string,
  details: Record<string, string | number>,
  measuredResponseTimeMs?: number,
): MonitorCheckOutcome {
  const responseTimeMs =
    measuredResponseTimeMs ?? Math.max(0, Math.round(performance.now() - startedAt));
  return {
    status,
    healthy: false,
    responseTimeMs,
    ...(status === "ERROR" ? { errorMessage: summary.slice(0, 500) } : {}),
    details: {
      checkType: "FORM",
      failureClass,
      ...details,
    },
    finding: {
      ruleId: "monitor.form",
      severity: "CRITICAL",
      title: "Critical lead form check failed",
      summary: summary.slice(0, 1_000),
      businessImpact:
        "A monitored lead-form workflow may be unavailable, which can prevent the business from receiving enquiries.",
      recommendedAction:
        "Open the configured page and form, confirm the safe probe endpoint, and verify the site's lead delivery path.",
    },
  };
}

function formFailure(
  startedAt: number,
  failureClass: string,
  summary: string,
  details: Record<string, string | number>,
): MonitorCheckOutcome {
  return failure(startedAt, "DOWN", failureClass, summary, details);
}

function parseMatchingForm(
  html: string,
  config: FormConfig,
  pageUrl: URL,
): {
  form: ParsedForm | null;
  matchedCount: number;
  failure?: { className: string; summary: string };
} {
  const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi) ?? [];
  const matches = forms.filter((tag) => {
    const id = attributeValue(tag, "id");
    const name = attributeValue(tag, "name");
    return id === config.formId || name === config.formId;
  });
  if (matches.length === 0) {
    return {
      form: null,
      matchedCount: 0,
      failure: {
        className: "form_not_found",
        summary: `No form with id or name "${config.formId}" was found on the configured page.`,
      },
    };
  }
  if (matches.length > 1) {
    return {
      form: null,
      matchedCount: matches.length,
      failure: {
        className: "form_ambiguous",
        summary: `More than one form with id or name "${config.formId}" was found; the workflow is not unambiguous.`,
      },
    };
  }

  const tag = matches[0]!;
  const methodValue = (attributeValue(tag, "method") ?? "get").toLowerCase();
  if (methodValue !== "get" && methodValue !== "post") {
    return {
      form: null,
      matchedCount: 1,
      failure: {
        className: "unsupported_method",
        summary: `The monitored form uses unsupported method ${methodValue.slice(0, 20)}.`,
      },
    };
  }

  const actionValue = attributeValue(tag, "action");
  let action: URL;
  try {
    action = new URL(actionValue ?? pageUrl.toString(), pageUrl);
  } catch {
    return {
      form: null,
      matchedCount: 1,
      failure: { className: "invalid_action", summary: "The monitored form action is invalid." },
    };
  }
  if (
    (action.protocol !== "http:" && action.protocol !== "https:") ||
    action.username !== "" ||
    action.password !== "" ||
    action.origin !== pageUrl.origin
  ) {
    return {
      form: null,
      matchedCount: 1,
      failure: {
        className: "unsafe_action",
        summary: "The monitored form action is not a credential-free same-origin HTTP(S) URL.",
      },
    };
  }
  return { form: { method: methodValue.toUpperCase() as "GET" | "POST", action }, matchedCount: 1 };
}

function commonDetails(config: FormConfig, pagePath: string): Record<string, string | number> {
  return {
    formId: config.formId,
    pagePath,
  };
}

/**
 * Runs the safe FORM v1 contract. It verifies that one explicitly named,
 * same-origin form is present and may HEAD an explicitly configured safe probe
 * endpoint. It never submits a form or sends lead data.
 */
export async function runFormCheck(
  url: string,
  rawConfig: unknown = {},
): Promise<MonitorCheckOutcome> {
  const startedAt = performance.now();
  const config = parseFormConfig(rawConfig);
  if (config === null) {
    return failure(
      startedAt,
      "ERROR",
      "invalid_configuration",
      "The form monitor requires a safe formId and optional relative pagePath/probePath values.",
      { configValid: 0 },
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(url);
  } catch {
    return failure(
      startedAt,
      "ERROR",
      "invalid_url",
      "The configured website URL is invalid.",
      commonDetails(config, config.pagePath ?? "/"),
    );
  }
  if (
    (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
    baseUrl.username !== "" ||
    baseUrl.password !== ""
  ) {
    return failure(
      startedAt,
      "ERROR",
      "invalid_url",
      "The configured website URL must be a credential-free HTTP(S) URL.",
      commonDetails(config, config.pagePath ?? "/"),
    );
  }

  const pagePath = config.pagePath ?? "/";
  const pageUrl = new URL(pagePath, baseUrl.origin);
  let page;
  try {
    page = await requestSafeOutbound(pageUrl.toString(), {
      method: "GET",
      timeoutMs: FORM_TIMEOUT_MS,
      maxBodyBytes: FORM_PAGE_MAX_BODY_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Page request failed.";
    return failure(startedAt, "ERROR", "page_transport", message, commonDetails(config, pagePath));
  }

  if (page.status < 200 || page.status >= 300) {
    const isRedirect = page.status >= 300 && page.status < 400;
    const isTransportFailure = page.status === 0;
    return failure(
      startedAt,
      isRedirect || isTransportFailure ? "ERROR" : "DOWN",
      isRedirect ? "page_redirect" : isTransportFailure ? "page_transport" : "page_http_status",
      isRedirect
        ? `The configured form page returned redirect HTTP ${page.status}; redirects are not followed.`
        : isTransportFailure
          ? "The configured form page returned no usable HTTP status."
          : `The configured form page returned HTTP ${page.status}.`,
      { ...commonDetails(config, pagePath), pageStatus: page.status },
    );
  }

  let html: string;
  try {
    html = await page.text();
  } catch {
    return failure(
      startedAt,
      "ERROR",
      "page_unreadable",
      "The configured form page could not be read.",
      { ...commonDetails(config, pagePath), pageStatus: page.status },
    );
  }

  const parsed = parseMatchingForm(html, config, pageUrl);
  if (parsed.form === null) {
    return formFailure(startedAt, parsed.failure!.className, parsed.failure!.summary, {
      ...commonDetails(config, pagePath),
      pageStatus: page.status,
      formFound: parsed.matchedCount,
    });
  }

  const formDetails = {
    ...commonDetails(config, pagePath),
    pageStatus: page.status,
    formFound: 1,
    method: parsed.form.method,
    actionPath: parsed.form.action.pathname.slice(0, FORM_MAX_PATH_LENGTH),
  };

  if (config.probePath === undefined) {
    const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
    return {
      status: "UP",
      healthy: true,
      responseTimeMs,
      httpStatusCode: page.status,
      details: {
        checkType: "FORM",
        probeMode: "PRESENCE",
        failureClass: "none",
        ...formDetails,
      },
      finding: {
        ruleId: "monitor.form",
        severity: "CRITICAL",
        title: "Critical lead form presence check passed",
        summary:
          "The configured form is present and same-origin. This safe v1 check does not submit a lead or prove downstream delivery.",
        businessImpact:
          "The monitored lead form is present on the configured page; downstream delivery still requires a separate canary or provider check.",
        recommendedAction:
          "Use a dedicated same-origin safe probe endpoint if you need availability evidence beyond form presence.",
      },
    };
  }

  const probeUrl = new URL(config.probePath, baseUrl.origin);
  let probe;
  try {
    probe = await requestSafeOutbound(probeUrl.toString(), {
      method: "HEAD",
      timeoutMs: FORM_TIMEOUT_MS,
      maxBodyBytes: 0,
    });
  } catch {
    return failure(
      startedAt,
      "ERROR",
      "probe_transport",
      "The configured same-origin form probe could not be completed.",
      {
        ...formDetails,
        probeMode: "HEAD",
        probePath: config.probePath,
        probeStatus: 0,
      },
    );
  }
  const measuredResponseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
  if (probe.status < 200 || probe.status >= 300) {
    const isRedirect = probe.status >= 300 && probe.status < 400;
    const isTransportFailure = probe.status === 0;
    return failure(
      startedAt,
      isRedirect || isTransportFailure ? "ERROR" : "DOWN",
      isRedirect ? "probe_redirect" : isTransportFailure ? "probe_transport" : "probe_http_status",
      isRedirect
        ? `The configured form probe returned redirect HTTP ${probe.status}; redirects are not followed.`
        : isTransportFailure
          ? "The configured form probe returned no usable HTTP status."
          : `The configured form probe returned HTTP ${probe.status}.`,
      {
        ...formDetails,
        probeMode: "HEAD",
        probePath: config.probePath,
        probeStatus: probe.status,
      },
      measuredResponseTimeMs,
    );
  }

  return {
    status: "UP",
    healthy: true,
    responseTimeMs: measuredResponseTimeMs,
    httpStatusCode: page.status,
    details: {
      checkType: "FORM",
      probeMode: "HEAD",
      failureClass: "none",
      ...formDetails,
      probePath: config.probePath,
      probeStatus: probe.status,
    },
    finding: {
      ruleId: "monitor.form",
      severity: "CRITICAL",
      title: "Critical lead form safe probe passed",
      summary:
        "The configured form is present and its explicitly configured same-origin HEAD probe responded successfully. This does not submit a lead or prove downstream delivery.",
      businessImpact:
        "The monitored form page and safe probe are available; downstream lead delivery still requires a separate canary or provider check.",
      recommendedAction:
        "Keep the safe probe endpoint independent of real lead submission and verify delivery separately before enabling synthetic tests.",
    },
  };
}
