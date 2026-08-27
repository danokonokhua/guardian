import { describe, expect, it } from "vitest";

import { newRequestId, resolveRequestId } from "@/lib/api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestWithId(id: string | null): Request {
  const headers = new Headers();
  if (id !== null) {
    headers.set("x-request-id", id);
  }
  return new Request("https://guardian.test/api/v1/health", { headers });
}

describe("resolveRequestId (validated client propagation)", () => {
  it("propagates a safe client-supplied request id", () => {
    expect(resolveRequestId(requestWithId("req-1234-abcd"))).toBe("req-1234-abcd");
    expect(resolveRequestId(requestWithId("ABCdef.123_x-9"))).toBe("ABCdef.123_x-9");
  });

  it("rejects oversized request ids and generates a UUID instead", () => {
    expect(resolveRequestId(requestWithId("a".repeat(65)))).toMatch(UUID_PATTERN);
  });

  it("rejects malformed / injection-capable request ids", () => {
    // NOTE: the fetch Headers API already rejects control chars/non-ASCII
    // values client-side; these are the malformed cases that can actually
    // reach the boundary. The safe-charset regex guards everything else.
    for (const bad of ["short", "../../etc/passwd", "id with spaces", "'; DROP TABLE users;--"]) {
      expect(resolveRequestId(requestWithId(bad))).toMatch(UUID_PATTERN);
    }
  });

  it("generates a fresh UUID when the header is absent", () => {
    expect(resolveRequestId(requestWithId(null))).toMatch(UUID_PATTERN);
    expect(newRequestId()).not.toBe(newRequestId());
  });
});
