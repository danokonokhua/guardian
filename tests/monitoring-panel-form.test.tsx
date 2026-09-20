// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitoringPanel } from "@/app/monitoring-panel";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MonitoringPanel FORM option", () => {
  it("creates a tenant-scoped safe form monitor configuration", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/monitors") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: { id: "monitor-form" } }), { status: 201 });
      }
      if (url.endsWith("/monitors")) return new Response(JSON.stringify({ data: [] }));
      if (url.endsWith("/websites")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "website-1",
                hostname: "example.com",
                label: "Example",
                verifyStatus: "VERIFIED",
              },
            ],
          }),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    expect(await screen.findByRole("option", { name: "Lead generation (forms)" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Reputation (coming soon)" })).toBeDisabled();
    await user.selectOptions(await screen.findByLabelText("Website"), "website-1");
    await user.selectOptions(screen.getByLabelText("Check type"), "FORM");
    await user.type(screen.getByLabelText("Form ID or name"), "contact-form");
    await user.type(screen.getByLabelText("Page path (optional)"), "/contact");
    await user.type(screen.getByLabelText("Safe probe path (optional)"), "/api/lead-health");
    await user.click(screen.getByRole("button", { name: "Add check" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/organizations/${ORGANIZATION_ID}/monitors`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const createCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url).endsWith("/monitors") && options?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      websiteId: "website-1",
      type: "FORM",
      enabled: true,
      frequencyMinutes: 5,
      config: { formId: "contact-form", pagePath: "/contact", probePath: "/api/lead-health" },
    });
  });
});
