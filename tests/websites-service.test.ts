import { describe, expect, it, vi } from "vitest";

import type { TenantScope } from "@/db/tenant";

const { createMock, listMock, findVerificationMock, setVerificationMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
  findVerificationMock: vi.fn(),
  setVerificationMock: vi.fn(),
}));
const lookupMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
);
const { requestSafeMock, resolveSafeMock } = vi.hoisted(() => ({
  requestSafeMock: vi.fn(),
  resolveSafeMock: vi.fn().mockResolvedValue({
    url: new URL("https://example.com"),
    hostname: "example.com",
    address: "93.184.216.34",
    family: 4,
  }),
}));
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));
vi.mock("@/lib/security/outbound-url", () => ({
  requestSafeOutbound: requestSafeMock,
  resolveSafeOutboundUrl: resolveSafeMock,
}));
vi.mock("@/services/websites/repository", () => ({
  createWebsite: createMock,
  listWebsites: listMock,
  findWebsiteForVerification: findVerificationMock,
  setWebsiteVerification: setVerificationMock,
}));

import { listConfiguredWebsites, onboardWebsite, verifyWebsite } from "@/services/websites/service";

const scope: TenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "44444444-4444-4444-8444-444444444444",
  role: "OWNER",
};

describe("website onboarding service", () => {
  it("normalizes HTTPS URLs and derives the hostname", async () => {
    createMock.mockResolvedValue({ id: "website-1", hostname: "example.com" });
    await onboardWebsite(scope, { url: "https://Example.com/path/#fragment" });
    expect(createMock).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({
        normalizedUrl: "https://example.com/path",
        hostname: "example.com",
      }),
    );
  });

  it("rejects non-HTTP website URLs as validation errors", async () => {
    await expect(onboardWebsite(scope, { url: "ftp://example.com" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects private IP monitoring targets", async () => {
    createMock.mockClear();
    resolveSafeMock.mockRejectedValueOnce(new Error("private destination"));
    await expect(onboardWebsite(scope, { url: "http://127.0.0.1:8080/admin" })).rejects.toThrow(
      "private destination",
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("lists through the tenant repository", async () => {
    listMock.mockResolvedValue([]);
    await expect(listConfiguredWebsites(scope)).resolves.toEqual([]);
    expect(listMock).toHaveBeenCalledWith(scope);
  });

  it("verifies a website from its well-known token and persists VERIFIED", async () => {
    findVerificationMock.mockResolvedValue({
      id: "website-1",
      normalizedUrl: "https://example.com",
      verifyToken: "token-123",
      verifyStatus: "PENDING",
    });
    setVerificationMock.mockResolvedValue({ id: "website-1", verifyStatus: "VERIFIED" });
    requestSafeMock.mockResolvedValue({ ok: true, status: 200, text: async () => "token-123" });
    await expect(verifyWebsite(scope, "website-1")).resolves.toMatchObject({
      verified: true,
      status: "VERIFIED",
    });
    expect(requestSafeMock).toHaveBeenCalledWith(
      "https://example.com/.well-known/guardian-verification.txt",
      expect.objectContaining({ method: "GET", maxBodyBytes: 2048 }),
    );
    expect(setVerificationMock).toHaveBeenCalledWith(scope, "website-1", "VERIFIED");
  });

  it("persists FAILED when the verification token does not match", async () => {
    findVerificationMock.mockResolvedValue({
      id: "website-1",
      normalizedUrl: "https://example.com",
      verifyToken: "token-123",
      verifyStatus: "PENDING",
    });
    setVerificationMock.mockResolvedValue({ id: "website-1", verifyStatus: "FAILED" });
    requestSafeMock.mockResolvedValue({ ok: true, status: 200, text: async () => "wrong" });
    await expect(verifyWebsite(scope, "website-1")).resolves.toMatchObject({
      verified: false,
      status: "FAILED",
    });
    expect(setVerificationMock).toHaveBeenCalledWith(scope, "website-1", "FAILED");
  });
});
