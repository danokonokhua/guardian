import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
const db = new PrismaClient(),
  org = randomUUID(),
  user = randomUUID(),
  token = randomBytes(32).toString("base64url");
test.beforeAll(async () => {
  if (
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      process.env.QA_BASE_URL ?? "http://localhost:3001",
    )
  )
    throw Error("Local QA only");
  await db.user.create({ data: { id: user, email: `status-qa-${user}@example.test` } });
  await db.organization.create({
    data: { id: org, ownerId: user, name: "Client services QA", slug: org },
  });
  await db.organizationMember.create({
    data: { organizationId: org, userId: user, role: "OWNER", status: "ACTIVE" },
  });
  await db.authSession.create({
    data: {
      userId: user,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
});
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: org } });
  await db.user.deleteMany({ where: { id: user } });
  await db.$disconnect();
});
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const) {
  test(`${name}: private creation, approved publication and immediate withdrawal`, async ({
    page,
    context,
    browser,
  }, info) => {
    await page.setViewportSize({ width, height });
    await context.addCookies([
      {
        name: "guardian_session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/status-pages");
    const create = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Create a client status page" }) });
    if (!(await create.getAttribute("open"))) await create.locator("summary").click();
    const slug = `qa-${name}-${randomUUID()}`;
    await create.getByLabel("Page name", { exact: true }).fill("Northstar Client Services");
    await create.getByLabel("Public address slug").fill(slug);
    await create.getByRole("button", { name: "Create private page" }).click();
    await expect(page.getByRole("status")).toHaveText("Private status page created.", {
      timeout: 20000,
    });
    expect((await page.request.get(`/api/status/${slug}`)).status()).toBe(404);
    const add = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Add service component" }) });
    await add.locator("summary").click();
    await add.getByLabel("New component name").fill("Client website");
    await add.getByLabel("Initial service state").selectOption("DEGRADED");
    await add.getByLabel("Include on published page").check();
    await add.getByRole("button", { name: "Add component", exact: true }).click();
    await expect(
      page.getByText("Client website · degraded · Visible", { exact: true }),
    ).toBeVisible();
    const incident = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Report an incident" }) });
    await incident.locator("summary").click();
    await incident.getByLabel("Incident title").fill("Elevated response times");
    await incident
      .getByLabel("Approved public summary")
      .fill("Some visitors may experience slower page loads. Our team is investigating.");
    await incident.getByLabel("Client website", { exact: true }).check();
    await incident.getByRole("button", { name: "Report incident", exact: true }).click();
    await expect(
      page.locator("summary", { hasText: "Manage incident: Elevated response times" }),
    ).toBeVisible();
    const maintenance = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Schedule maintenance" }) });
    await maintenance.locator("summary").click();
    await maintenance.getByLabel("Maintenance title").fill("Planned infrastructure update");
    await maintenance
      .getByLabel("Approved public summary")
      .fill("A short service interruption is expected during this window.");
    await maintenance.getByLabel("Client website", { exact: true }).check();
    await maintenance
      .getByLabel("Start (your local time)", { exact: true })
      .fill("2030-10-01T01:00");
    await maintenance.getByLabel("End (your local time)", { exact: true }).fill("2030-10-01T02:00");
    await maintenance.getByRole("button", { name: "Schedule window" }).click();
    await expect(page.getByRole("button", { name: "Cancel maintenance" })).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Status page published.");
    await page.screenshot({ path: info.outputPath("status-management.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const anonymous = await browser.newContext({ viewport: { width, height } }),
      publicPage = await anonymous.newPage();
    try {
      const response = await publicPage.goto(`http://localhost:3001/status/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(
        publicPage.getByRole("heading", { name: "Northstar Client Services", exact: true }),
      ).toBeVisible();
      await expect(
        publicPage.getByRole("heading", { name: "Degraded service", exact: true }),
      ).toBeVisible();
      await expect(
        publicPage.getByText("Planned infrastructure update", { exact: true }),
      ).toBeVisible();
      expect(
        await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await publicPage.screenshot({ path: info.outputPath("public-status.png"), fullPage: true });
      const json = await publicPage.request.get(`http://localhost:3001/api/status/${slug}`);
      expect(json.headers()["cache-control"]).toContain("no-store");
      expect(await json.text()).not.toContain(org);
      await page.getByRole("button", { name: "Cancel maintenance", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Maintenance cancelled", exact: true }),
      ).toBeDisabled();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Redact maintenance", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Redact maintenance", exact: true }),
      ).toHaveCount(0);
      const redacted = await publicPage.request.get(`http://localhost:3001/api/status/${slug}`);
      expect((await redacted.json()).data.maintenance).toEqual([]);
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Unpublish page", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Page unpublished. Public access removed.");
      expect(
        (await publicPage.request.get(`http://localhost:3001/api/status/${slug}`)).status(),
      ).toBe(404);
      expect((await publicPage.reload())?.status()).toBe(404);
    } finally {
      await anonymous.close();
    }
    expect(errors).toEqual([]);
  });
}
