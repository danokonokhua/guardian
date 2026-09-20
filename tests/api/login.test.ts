import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  beginLoginAttempt: vi.fn(),
  clearLoginThrottle: vi.fn(),
  createSession: vi.fn(),
  findUser: vi.fn(),
  transaction: vi.fn(),
  verifyPassword: vi.fn(),
}));

const prismaMock = {
  user: { findUnique: mocks.findUser, update: vi.fn() },
  authCredential: { update: vi.fn() },
  $transaction: mocks.transaction,
};

vi.mock("@/db/client", () => ({ getPrisma: () => prismaMock }));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  sessionCookieOptions: () => ({ name: "guardian_session", httpOnly: true, path: "/" }),
}));
vi.mock("@/lib/auth/login-throttle", () => ({
  beginLoginAttempt: mocks.beginLoginAttempt,
  clearLoginThrottle: mocks.clearLoginThrottle,
}));

import { POST } from "@/app/api/auth/login/route";

function loginRequest() {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ email: "owner@example.com", password: "wrong-password" }),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.beginLoginAttempt.mockResolvedValue({ limited: false });
    mocks.clearLoginThrottle.mockResolvedValue(undefined);
    mocks.createSession.mockResolvedValue({ token: "a".repeat(64) });
    mocks.transaction.mockResolvedValue([]);
  });

  it("does not mutate the account-wide credential lock after a bad password", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      authCredential: { userId: "user-1", passwordHash: "hash" },
    });
    mocks.verifyPassword.mockResolvedValue(false);

    const response = await POST(loginRequest());
    expect(response.status).toBe(401);
    expect(prismaMock.authCredential.update).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 429 before credential lookup when the source is throttled", async () => {
    mocks.beginLoginAttempt.mockResolvedValue({ limited: true, retryAfterSeconds: 30 });
    const response = await POST(loginRequest());
    expect(response.status).toBe(429);
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
