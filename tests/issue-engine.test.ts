import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, findUnique, upsert, updateMany, update, issueActivityCreate, executeRaw } =
  vi.hoisted(() => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    issueActivityCreate: vi.fn(),
    executeRaw: vi.fn().mockResolvedValue(0),
  }));
vi.mock("@/db/client", () => ({
  getPrisma: () => ({
    website: { findFirst },
    issue: { findFirst, findUnique, upsert, updateMany, update },
    issueActivity: { create: issueActivityCreate },
    $executeRaw: executeRaw,
  }),
}));
vi.mock("@/db/tenant", () => ({
  withGucContext: async (_scope: unknown, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      issue: { findFirst, update },
      issueActivity: { create: issueActivityCreate },
    }),
}));
import {
  issueFingerprint,
  recordFinding,
  resolveFinding,
  resolveFindingScoped,
} from "@/lib/issue-engine";

describe("issue engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates deterministic fingerprints", () => {
    const input = { ruleId: "uptime.down", websiteId: "w1", subjectKey: "homepage" };
    expect(issueFingerprint(input)).toBe(issueFingerprint(input));
    expect(issueFingerprint(input)).toHaveLength(64);
    expect(issueFingerprint({ ...input, subjectKey: "checkout" })).not.toBe(
      issueFingerprint(input),
    );
  });

  it("creates a new issue and deduplicates recurrence", async () => {
    findFirst.mockResolvedValue({ id: "w1" });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "i1", status: "OPEN" });
    upsert.mockResolvedValue({ id: "i1" });
    const finding = {
      organizationId: "o1",
      websiteId: "w1",
      ruleId: "r1",
      subjectKey: "home",
      severity: "HIGH",
      title: "Down",
      summary: "Unavailable",
    } as const;
    await expect(recordFinding(finding)).resolves.toEqual({ id: "i1", created: true });
    await expect(recordFinding(finding)).resolves.toEqual({ id: "i1", created: false });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("resolves a finding by fingerprint", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(resolveFinding("f".repeat(64))).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fingerprint: "f".repeat(64), status: { not: "RESOLVED" } },
      }),
    );
  });

  it("records a system activity when a recovered finding reopens", async () => {
    findFirst.mockResolvedValue({ id: "w1" });
    findUnique.mockResolvedValue({ id: "i1", status: "RESOLVED" });
    upsert.mockResolvedValue({ id: "i1" });
    await recordFinding({
      organizationId: "o1",
      websiteId: "w1",
      ruleId: "r1",
      subjectKey: "home",
      severity: "HIGH",
      title: "Down",
      summary: "Unavailable",
      impactConfidence: 1.5,
      recommendedAction: "Inspect the origin.",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          impactConfidence: 1,
          metadata: { recommendedAction: "Inspect the origin." },
          resolvedByUser: { disconnect: true },
        }),
      }),
    );
    expect(issueActivityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "o1",
        issueId: "i1",
        action: "REOPENED",
        fromStatus: "RESOLVED",
        toStatus: "OPEN",
        metadata: { source: "monitor" },
      }),
    });
  });

  it("records a system activity when a scoped finding resolves", async () => {
    findFirst.mockResolvedValue({ id: "i1", status: "IN_PROGRESS" });
    update.mockResolvedValue({ id: "i1" });
    await resolveFindingScoped({ organizationId: "o1" }, "f".repeat(64));
    expect(update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { status: "RESOLVED", resolvedAt: expect.any(Date), resolvedBy: "SYSTEM" },
    });
    expect(issueActivityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "o1",
        issueId: "i1",
        action: "RESOLVED",
        fromStatus: "IN_PROGRESS",
        toStatus: "RESOLVED",
        metadata: { source: "monitor" },
      }),
    });
  });

  it("rejects a website from another organization", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      recordFinding({
        organizationId: "o1",
        websiteId: "w2",
        ruleId: "r",
        subjectKey: "s",
        severity: "LOW",
        title: "x",
        summary: "x",
      }),
    ).rejects.toThrow("does not belong");
  });
});
