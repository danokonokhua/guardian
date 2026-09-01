import { describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
vi.mock("@/db/client", () => ({
  getPrisma: () => ({ website: { findFirst }, issue: { findUnique, upsert, updateMany } }),
}));
import { issueFingerprint, recordFinding, resolveFinding } from "@/lib/issue-engine";

describe("issue engine", () => {
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
