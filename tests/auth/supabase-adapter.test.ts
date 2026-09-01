import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const createServerClientMock = vi.hoisted(() => vi.fn(() => ({ auth: { getUser: getUserMock } })));
const cookieStore = vi.hoisted(() => ({
  getAll: vi.fn(() => []),
  set: vi.fn(),
}));
const headersMock = vi.hoisted(() => vi.fn(async () => new Headers()));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore), headers: headersMock }));

import { SupabaseAuthAdapter } from "@/lib/auth/supabase-adapter";

describe("SupabaseAuthAdapter", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createServerClientMock.mockClear();
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
    headersMock.mockReset().mockResolvedValue(new Headers());
  });

  it("maps the verified Supabase user to the Guardian identity contract", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "supabase-user-1" } }, error: null });

    const identity = await new SupabaseAuthAdapter(
      "https://guardian.supabase.co",
      "anon-key",
    ).getSessionIdentity();

    expect(identity).toEqual({ userId: "supabase-user-1" });
    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://guardian.supabase.co",
      "anon-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
    const calls = createServerClientMock.mock.calls as unknown[][];
    const options = calls[0]?.[2] as {
      cookies: { getAll: () => unknown };
    };
    options.cookies.getAll();
    expect(cookieStore.getAll).toHaveBeenCalledOnce();
  });

  it("fails closed when Supabase reports an invalid or missing session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid session") });

    await expect(
      new SupabaseAuthAdapter("https://guardian.supabase.co", "anon-key").getSessionIdentity(),
    ).resolves.toBeNull();
  });

  it("accepts an Authorization bearer token for API clients", async () => {
    headersMock.mockResolvedValue(new Headers({ authorization: "Bearer api-token" }));
    getUserMock.mockResolvedValue({ data: { user: { id: "api-user" } }, error: null });
    await expect(
      new SupabaseAuthAdapter("https://guardian.supabase.co", "anon-key").getSessionIdentity(),
    ).resolves.toEqual({ userId: "api-user" });
    expect(getUserMock).toHaveBeenCalledWith("api-token");
  });
});
