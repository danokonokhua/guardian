import { afterEach, describe, expect, it, vi } from "vitest";

import { captureException, init } from "@sentry/node";

import { captureUnexpectedError, isSentryEnabled } from "@/lib/observability/sentry";

// Replace the ESM namespace with mock functions — spying on real ESM exports
// is impossible (non-configurable bindings), and these tests must observe
// whether the SDK's entry points are ever touched in the disabled state.
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  captureException: vi.fn((): string => ""),
}));

/**
 * Sentry foundation tests — disabled-path verification only.
 *
 * The development/test environment deliberately has NO SENTRY_DSN, so these
 * tests prove the optional foundation is a true no-op without configuration:
 * no initialization, no capture calls, no thrown errors. Runtime verification
 * of the enabled path (real DSN ingestion) is honestly OUT OF SCOPE here — it
 * requires an external Sentry project and is documented as such in
 * docs/PROJECT_STATE.md.
 */

describe("sentry foundation (no SENTRY_DSN configured)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports itself disabled when the DSN is absent", () => {
    expect(process.env["SENTRY_DSN"]).toBeUndefined();
    expect(isSentryEnabled()).toBe(false);
  });

  it("captureUnexpectedError is a safe no-op when disabled", () => {
    expect(() =>
      captureUnexpectedError(new Error("boom"), { requestId: "req-12345678" }),
    ).not.toThrow();
  });

  it("never throws even when given hostile inputs", () => {
    expect(() => captureUnexpectedError(null, {})).not.toThrow();
    expect(() => captureUnexpectedError("string error", { weird: Symbol("x") })).not.toThrow();
    expect(() => captureUnexpectedError(undefined, undefined)).not.toThrow();
  });

  it("does not initialize or capture through the Sentry SDK when disabled", () => {
    captureUnexpectedError(new Error("ignored"), { requestId: "req-87654321" });

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
