import "server-only";
import { requestSafeOutbound } from "@/lib/security/outbound-url";
import { analyzeAccessibility } from "./analyze";
import { ACCESSIBILITY_TOOL, type AccessibilitySnapshot } from "./types";
export async function collectAccessibility(url: string): Promise<AccessibilitySnapshot> {
  const checkedAt = new Date().toISOString();
  let page = "Invalid page URL";
  try {
    const parsed = new URL(url);
    page = parsed.origin + parsed.pathname;
  } catch {}
  const unknown = (reason: string): AccessibilitySnapshot => ({
    state: "UNKNOWN",
    checkedAt,
    page,
    tool: ACCESSIBILITY_TOOL,
    scope: "SERVER_HTML_SINGLE_PAGE",
    findings: [],
    elements: 0,
    reason,
  });
  try {
    const signal = AbortSignal.timeout(10000);
    let abort: () => void = () => {};
    const deadline = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new Error("Accessibility request deadline exceeded."));
      signal.addEventListener("abort", abort, { once: true });
    });
    const response = await Promise.race([
      requestSafeOutbound(url, {
        method: "GET",
        timeoutMs: 10000,
        maxBodyBytes: 262144,
        headers: { accept: "text/html", "accept-encoding": "identity" },
        signal,
      }),
      deadline,
    ]).finally(() => signal.removeEventListener("abort", abort));
    if (!response.ok)
      return unknown(`Page returned HTTP ${response.status}; redirects are not followed.`);
    if (response.bodyTruncated) return unknown("HTML exceeds the 256 KiB scan limit.");
    const contentType = response.headers?.["content-type"] ?? "";
    const encoding = response.headers?.["content-encoding"];
    if (encoding && encoding.toLowerCase() !== "identity")
      return unknown("Compressed responses are outside this HTML scan's scope.");
    const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1]?.toLowerCase();
    if (charset && !["utf-8", "utf8", "us-ascii"].includes(charset))
      return unknown("The declared character encoding is not supported by this HTML scan.");
    if (!/^text\/html(?:\s*;|\s*$)/i.test(contentType))
      return unknown("The response is not declared as text/html.");
    return analyzeAccessibility(await response.text(), page, checkedAt);
  } catch {
    return unknown("Page could not be fetched securely within the request limits.");
  }
}
