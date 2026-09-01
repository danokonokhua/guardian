// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import type { AuthenticatedUser, IdentityRepository } from "@/lib/auth/identity";
import DashboardPage from "@/app/dashboard/page";

const USER_ID = "44444444-4444-4444-8444-444444444444";
const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

const user: AuthenticatedUser = {
  userId: USER_ID,
  email: "alice@example.test",
  name: "Alice",
  status: "ACTIVE",
};

const repository: IdentityRepository = {
  async findUserById(userId) {
    return userId === USER_ID ? user : null;
  },
  async findMembership(userId, organizationId) {
    return userId === USER_ID && organizationId === ORGANIZATION_ID
      ? { organizationId, role: "OWNER", status: "ACTIVE" }
      : null;
  },
  async listMemberships(userId) {
    return userId === USER_ID
      ? [{ organizationId: ORGANIZATION_ID, role: "OWNER", status: "ACTIVE" }]
      : [];
  },
};

const adapter: AuthAdapter = { getSessionIdentity: async () => ({ userId: USER_ID }) };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("authenticated dashboard", () => {
  beforeEach(() => {
    setAuthAdapter(adapter);
    setIdentityRepository(repository);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
  });

  it("renders notifications with the authenticated user's active organization", async () => {
    const page = await DashboardPage();
    render(page);

    expect(screen.getByText("alice@example.test · owner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/v1/organizations/${ORGANIZATION_ID}/notifications`);
  });
});
