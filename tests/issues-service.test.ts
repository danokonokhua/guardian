import { describe, expect, it, vi } from "vitest";

const { updateMock, listMock, findMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  listMock: vi.fn(),
  findMock: vi.fn(),
}));
vi.mock("@/services/issues/repository", () => ({
  updateIssueLifecycle: updateMock,
  listIssues: listMock,
  findIssue: findMock,
}));

import {
  applyIssueLifecycle,
  getOrganizationIssue,
  listOrganizationIssues,
} from "@/services/issues/service";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "OWNER" as const,
};

describe("issue service", () => {
  it.each([
    ["ACKNOWLEDGE", "ACKNOWLEDGED"],
    ["IGNORE", "IGNORED"],
    ["RESOLVE", "RESOLVED"],
  ] as const)("maps %s to %s", async (action, status) => {
    updateMock.mockResolvedValue({ id: "i1", status });
    await expect(applyIssueLifecycle(scope, "i1", { action })).resolves.toEqual({
      id: "i1",
      status,
    });
    expect(updateMock).toHaveBeenCalledWith(scope, "i1", { status, assignedToId: undefined });
  });

  it("requires an assignee for ASSIGN", async () => {
    await expect(applyIssueLifecycle(scope, "i1", { action: "ASSIGN" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("passes a UUID assignee through", async () => {
    updateMock.mockResolvedValue({ id: "i1", status: "OPEN" });
    const assignee = "33333333-3333-4333-8333-333333333333";
    await applyIssueLifecycle(scope, "i1", { action: "ASSIGN", assignedToId: assignee });
    expect(updateMock).toHaveBeenCalledWith(scope, "i1", {
      status: undefined,
      assignedToId: assignee,
    });
  });

  it("delegates tenant-scoped reads", async () => {
    listMock.mockResolvedValue([]);
    findMock.mockResolvedValue(null);
    await expect(listOrganizationIssues(scope)).resolves.toEqual([]);
    await expect(getOrganizationIssue(scope, "i1")).resolves.toBeNull();
  });
});
