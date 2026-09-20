import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  registerAccount: vi.fn(),
}));

vi.mock("@/lib/auth/signup", () => ({ registerAccount: mocks.registerAccount }));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  sessionCookieOptions: () => ({ name: "guardian_session", httpOnly: true, path: "/" }),
}));

import { POST } from "@/app/api/auth/signup/route";

function signupRequest(payload: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registerAccount.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    mocks.createSession.mockResolvedValue({ token: "a".repeat(64) });
  });

  it("creates a session and returns 201 for a valid signup", async () => {
    const response = await POST(
      signupRequest({
        name: "Alice",
        organizationName: "Acme",
        email: " Alice@Example.com ",
        password: "correct horse battery staple",
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mocks.registerAccount).toHaveBeenCalledWith({
      name: "Alice",
      organizationName: "Acme",
      email: "alice@example.com",
      password: "correct horse battery staple",
    });
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
    expect(response.headers.get("set-cookie")).toContain("guardian_session=");
  });

  it("rejects malformed input before touching the database", async () => {
    const response = await POST(signupRequest({ email: "not-an-email", password: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Enter a valid name, email, and password.",
    });
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it("maps duplicate email conflicts to a client-safe 409", async () => {
    mocks.registerAccount.mockRejectedValue(
      new ConflictError("An account with that email already exists."),
    );

    const response = await POST(
      signupRequest({ email: "owner@example.com", password: "correct horse battery staple" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "CONFLICT", message: "An account with that email already exists." },
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
