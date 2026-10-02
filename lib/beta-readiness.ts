/** Read-only deployment checks. Passing these does not establish beta/product readiness. */
export async function checkBetaDeployment(base: string, request: typeof fetch = fetch) {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw Error("Use an application origin without credentials, path, query or fragment.");
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw Error("Use HTTPS, or HTTP for a loopback-only local application.");
  const definitions = [
    { name: "Application liveness", path: "/api/health", status: 200, kind: "live" },
    { name: "Database readiness", path: "/api/health/ready", status: 200, kind: "ready" },
    { name: "Login page", path: "/login", status: 200, kind: "html" },
    {
      name: "Anonymous tenant access denied",
      path: "/api/v1/organizations/00000000-0000-4000-8000-000000000000/monitors",
      status: 401,
      kind: "auth",
    },
    {
      name: "Unpublished status page unavailable",
      path: "/api/status/guardian-beta-check-00000000-0000-4000-8000-000000000000",
      status: 404,
      kind: "private",
    },
  ];
  const checks = await Promise.all(
    definitions.map(async (check) => {
      try {
        const response = await request(new URL(check.path, url), {
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        let passed = response.status === check.status;
        let detail = `HTTP ${response.status}; expected ${check.status}`;
        if (passed && check.kind === "html")
          passed = (response.headers.get("content-type") ?? "").includes("text/html");
        if (passed && ["live", "ready", "private"].includes(check.kind)) {
          const body = await response.json();
          if (check.kind === "live") passed = body.status === "ok";
          if (check.kind === "ready") {
            passed =
              body.status === "ok" &&
              body.checks?.application?.status === "healthy" &&
              body.checks?.database?.status === "healthy";
            detail = passed
              ? "Application and configured database are healthy."
              : "Readiness must include a healthy configured database; HTTP 200 alone is insufficient.";
          }
          if (check.kind === "private")
            passed =
              body.error === "Status page not found" &&
              (response.headers.get("cache-control") ?? "").includes("no-store");
        }
        return { name: check.name, passed, detail };
      } catch {
        return {
          name: check.name,
          passed: false,
          detail: "Request failed, timed out, or returned an invalid response.",
        };
      }
    }),
  );
  return {
    origin: url.origin,
    checkedAt: new Date().toISOString(),
    technicalChecksPassed: checks.every((c) => c.passed),
    checks,
    unverified: [
      "Authenticated customer workflows and tenant isolation in the target deployment",
      "Worker recurrence and real alert receipt",
      "Backup restoration and operational ownership",
      "Customer-confirmed outcomes and beta release decision",
    ],
  };
}
