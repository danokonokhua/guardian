import { expect, it, vi } from "vitest";
import { checkBetaDeployment } from "@/lib/beta-readiness";
function responder(database = "healthy") {
  return vi.fn(async (input: URL | RequestInfo) => {
    const path = new URL(String(input)).pathname;
    if (path === "/login")
      return new Response("Login", { headers: { "content-type": "text/html" } });
    if (path.includes("/organizations/")) return new Response("Unauthorized", { status: 401 });
    if (path.includes("/api/status/"))
      return Response.json(
        { error: "Status page not found" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    return Response.json({
      status: database === "healthy" ? "ok" : "degraded",
      checks: { application: { status: "healthy" }, database: { status: database } },
    });
  });
}
it("keeps deployment checks separate from customer and operational release gates", async () => {
  const request = responder();
  const report = await checkBetaDeployment("http://localhost:3000", request);
  expect(report.technicalChecksPassed).toBe(true);
  expect(report.unverified.length).toBeGreaterThan(0);
  for (const call of request.mock.calls) expect(String(call[0])).not.toContain("password");
});
it("fails a 200 readiness response with no configured database", async () => {
  const report = await checkBetaDeployment(
    "https://guardian.example.test",
    responder("not_configured"),
  );
  expect(report.technicalChecksPassed).toBe(false);
  expect(report.checks.find((c) => c.name === "Database readiness")?.passed).toBe(false);
});
it("rejects credentials before making any request", async () => {
  const request = responder();
  await expect(checkBetaDeployment("https://user:secret@example.test", request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it("does not leak transport errors into its report", async () => {
  const request = vi.fn().mockRejectedValue(Error("private transport detail"));
  const report = await checkBetaDeployment("http://localhost:3000", request);
  expect(report.technicalChecksPassed).toBe(false);
  expect(JSON.stringify(report)).not.toContain("private transport detail");
});
