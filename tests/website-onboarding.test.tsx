// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { WebsiteOnboarding } from "@/app/onboarding/website-onboarding";
vi.mock("next/navigation", () => ({ usePathname: () => "/onboarding/verify" }));
const site = {
  id: "site-1",
  hostname: "example.com",
  normalizedUrl: "https://example.com",
  verifyStatus: "PENDING",
  verifyToken: "test-token",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps an unsuccessful HTTP-200 verification pending and allows retry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [site] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: { verified: false } })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { verified: true, website: { ...site, verifyStatus: "VERIFIED" } },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<WebsiteOnboarding organizationId="org-1" canCreate canVerify />);
  fireEvent.click(await screen.findByRole("button", { name: "Verify ownership" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
  expect(screen.queryByRole("link", { name: "Configure monitoring" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Verify ownership" }));
  expect(await screen.findByRole("link", { name: "Configure monitoring" })).toHaveAttribute(
    "href",
    "/dashboard#monitoring",
  );
  expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/organizations/org-1/websites/site-1/verify", {
    method: "POST",
  });
});
it("does not expose verification actions to read-only members", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [site] }))));
  render(<WebsiteOnboarding organizationId="org-1" canCreate={false} canVerify={false} />);
  expect(await screen.findByText("example.com")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Verify ownership" })).not.toBeInTheDocument();
});
