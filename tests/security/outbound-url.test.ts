import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { resolveSafeOutboundUrl } from "@/lib/security/outbound-url";

describe("outbound URL security boundary", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("allows a public HTTPS destination", async () => {
    await expect(resolveSafeOutboundUrl("https://example.com/health")).resolves.toMatchObject({
      hostname: "example.com",
      address: "93.184.216.34",
      family: 4,
    });
  });

  it("prefers a safe IPv4 address when both DNS families are available", async () => {
    lookupMock.mockResolvedValue([
      { address: "2606:4700:3032::ac43:a95e", family: 6 },
      { address: "104.21.87.104", family: 4 },
    ]);
    await expect(resolveSafeOutboundUrl("https://dual-stack.example")).resolves.toMatchObject({
      address: "104.21.87.104",
      family: 4,
    });
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://10.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
  ])("rejects non-public literal target %s", async (url) => {
    await expect(resolveSafeOutboundUrl(url)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects a hostname when any DNS result is non-public", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(resolveSafeOutboundUrl("https://rebind.example")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects URLs containing credentials", async () => {
    await expect(resolveSafeOutboundUrl("https://user:secret@example.com")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
