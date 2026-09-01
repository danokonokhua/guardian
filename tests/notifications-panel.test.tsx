// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationsPanel } from "@/app/notifications-panel";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function notification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: NOTIFICATION_ID,
    title: "Monitor down",
    body: "api.example.test is unreachable.",
    readAt: null,
    createdAt: "2026-08-30T12:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NotificationsPanel", () => {
  it("shows a loading indicator while the API request is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);

    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("shows the empty state when there are no notifications", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [] })));

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);

    expect(await screen.findByText("You’re all caught up.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/v1/organizations/${ORGANIZATION_ID}/notifications`);
  });

  it("styles unread notifications and marks them read successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [notification()] }))
      .mockResolvedValueOnce(jsonResponse({ data: { updated: true } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);

    const title = await screen.findByText("Monitor down");
    const item = title.closest("li");
    expect(item).toHaveClass("border-emerald-700/60");

    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v1/organizations/${ORGANIZATION_ID}/notifications/${NOTIFICATION_ID}/read`,
      { method: "PATCH" },
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark read" })).toBeNull());
    expect(item).toHaveClass("border-neutral-800");
  });

  it("styles read notifications without a mark-read action", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [notification({ readAt: "2026-08-30T12:01:00.000Z" })] }),
        ),
    );

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);

    const item = (await screen.findByText("Monitor down")).closest("li");
    expect(item).toHaveClass("border-neutral-800");
    expect(screen.queryByRole("button", { name: "Mark read" })).toBeNull();
  });

  it("shows the API request ID when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), {
          status: 500,
          headers: { "x-request-id": "request-error-123" },
        }),
      ),
    );

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);

    expect(
      await screen.findByText("Unable to load notifications (request request-error-123)"),
    ).toBeInTheDocument();
  });

  it("updates the read state after a successful PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [notification()] }))
      .mockResolvedValueOnce(jsonResponse({ data: { updated: true } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationsPanel organizationId={ORGANIZATION_ID} />);
    await screen.findByText("Monitor down");
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Mark read" })).not.toBeInTheDocument();
    });
  });
});
