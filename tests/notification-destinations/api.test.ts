import { expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/context", () => ({ requirePermission: auth }));
vi.mock("@/services/notifications/destinations", () => ({
  listDestinations: list,
  createDestination: vi.fn(),
}));
import {
  GET,
  POST,
} from "@/app/api/v1/organizations/[organizationId]/notifications/destinations/route";
import { ForbiddenError } from "@/lib/errors";
it("gates both reads and writes on owner/admin organization settings permission", async () => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  auth.mockRejectedValue(new ForbiddenError());
  for (const handler of [GET, POST]) {
    const response = await handler(new Request("http://localhost/destinations"), {
      params: Promise.resolve({ organizationId }),
    });
    expect(response.status).toBe(403);
    expect(auth).toHaveBeenCalledWith(organizationId, "org:update");
  }
  expect(list).not.toHaveBeenCalled();
});
it("rejects malformed JSON without logging secret input fragments", async () => {
  auth.mockResolvedValue({});
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await POST(
      new Request("http://localhost/destinations", {
        method: "POST",
        body: '{"url":"SECRET_TOKEN',
      }),
      { params: Promise.resolve({ organizationId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("SECRET_TOKEN");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET_TOKEN");
  } finally {
    log.mockRestore();
  }
});
