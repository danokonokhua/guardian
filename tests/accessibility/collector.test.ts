import { beforeEach, expect, it, vi } from "vitest";
const fetchPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound: fetchPage }));
import { collectAccessibility } from "@/lib/accessibility/collector";
beforeEach(() => {
  fetchPage.mockReset();
});
const good = {
  ok: true,
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
  text: async () => '<html lang="en"><title>Example</title><button>Save</button></html>',
};
it("collects one HTML page with a body cap, abort signal and no subresource requests", async () => {
  fetchPage.mockResolvedValue(good);
  const result = await collectAccessibility("https://example.com/page?token=SECRET");
  expect(result.state).toBe("CHECKED");
  expect(result.page).toBe("https://example.com/page");
  expect(fetchPage).toHaveBeenCalledOnce();
  expect(fetchPage).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      method: "GET",
      timeoutMs: 10000,
      maxBodyBytes: 262144,
      signal: expect.any(AbortSignal),
    }),
  );
});
it.each([
  { ...good, status: 302, ok: false },
  { ...good, status: 500, ok: false },
  { ...good, bodyTruncated: true },
  { ...good, headers: { "content-type": "application/json" } },
  { ...good, headers: { "content-type": "text/html", "content-encoding": "gzip" } },
  { ...good, headers: { "content-type": "text/html;charset=shift_jis" } },
])("keeps incomplete or unsupported responses unknown", async (response) => {
  fetchPage.mockResolvedValue(response);
  const result = await collectAccessibility("https://example.com/");
  expect(result.state).toBe("UNKNOWN");
  expect(result.findings).toEqual([]);
});
it("does not expose raw transport errors", async () => {
  fetchPage.mockRejectedValue(Error("secret query token"));
  expect(JSON.stringify(await collectAccessibility("https://example.com/"))).not.toContain(
    "secret query token",
  );
});
it("returns unknown on the overall deadline even if DNS resolution is still pending", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  try {
    fetchPage.mockReturnValue(new Promise(() => {}));
    const pending = collectAccessibility("https://example.com/");
    controller.abort();
    expect((await pending).state).toBe("UNKNOWN");
  } finally {
    timeout.mockRestore();
  }
});
