import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

// Opt-in, local-only QA. Disposable data; no scheduler dispatch or outbound email.
const db = new PrismaClient();
const userId = randomUUID(),
  organizationId = randomUUID(),
  websiteId = randomUUID(),
  monitorId = randomUUID();
const token = randomBytes(32).toString("base64url");
const baseline = {
  A: ["203.0.113.1"],
  AAAA: [],
  MX: ["0 ."],
  NS: ["ns1.example.test"],
  TXT: ["v=spf1 -all"],
};
const latest = Object.fromEntries(
  Object.entries(baseline).map(([type, records]) => [
    type,
    { state: "OK", records: type === "A" ? ["203.0.113.2"] : records },
  ]),
);
test.beforeAll(async () => {
  if (
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      process.env.QA_BASE_URL ?? "http://localhost:3001",
    )
  )
    throw Error("QA requires a local app");
  await db.user.create({ data: { id: userId, email: `qa-${userId}@example.test` } });
  await db.organization.create({
    data: {
      id: organizationId,
      name: "Guardian QA Studio",
      slug: `qa-${organizationId}`,
      ownerId: userId,
    },
  });
  await db.organizationMember.create({
    data: { organizationId, userId, role: "OWNER", status: "ACTIVE" },
  });
  await db.authSession.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const business = await db.business.create({ data: { organizationId, name: "QA Business" } });
  await db.website.create({
    data: {
      id: websiteId,
      organizationId,
      businessId: business.id,
      hostname: "qa.example.test",
      normalizedUrl: "https://qa.example.test",
      verifyStatus: "VERIFIED",
    },
  });
  await db.monitor.create({
    data: {
      id: monitorId,
      organizationId,
      websiteId,
      type: "DNS",
      enabled: false,
      frequencyMinutes: 5,
      config: { baseline, latest, observedAt: new Date().toISOString() },
    },
  });
  await db.issue.create({
    data: {
      organizationId,
      websiteId,
      monitorId,
      ruleId: "monitor.dns",
      fingerprint: randomUUID(),
      severity: "MEDIUM",
      title: "DNS records changed",
      summary: "Review the routing change before accepting the baseline.",
    },
  });
});
test.afterAll(async () => {
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const) {
  test(`${name}: routes, DNS evidence and responsive layout`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await db.monitor.update({
      where: { id: monitorId },
      data: { config: { baseline, latest, observedAt: new Date().toISOString() } },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/audit",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${path.replaceAll("/", "") || "home"}.png`),
        fullPage: true,
      });
      expect
        .soft(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${path} overflow`,
        )
        .toBe(true);
    }
    await context.addCookies([
      {
        name: "guardian_session",
        value: token,
        url: process.env.QA_BASE_URL ?? "http://localhost:3001",
      },
    ]);
    for (const path of [
      "/dashboard",
      "/health",
      "/seo",
      "/security",
      "/revenue",
      "/settings/alerts",
      "/onboarding",
      "/onboarding/verify",
      "/briefings",
      "/dashboard/executive",
      "/billing",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1").first()).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${path.slice(1).replaceAll("/", "-")}.png`),
        fullPage: true,
      });
      expect
        .soft(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${path} overflow`,
        )
        .toBe(true);
    }
    await page.goto("/dashboard#monitoring");
    await page.getByText("DNS records and baseline", { exact: true }).click();
    await expect(page.getByText("Added:", { exact: true })).toBeVisible();
    await expect(page.getByText("Removed:", { exact: true })).toBeVisible();
    await page.getByText("DNS records and baseline", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("dns-expanded.png"), fullPage: true });
    expect
      .soft(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Expanded DNS overflow",
      )
      .toBe(true);
    await page
      .locator("details")
      .filter({ hasText: "DNS records and baseline" })
      .screenshot({ path: testInfo.outputPath("dns-card.png") });
    await page.getByRole("button", { name: "View details", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hide details", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("incident-details.png"), fullPage: true });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Accept displayed baseline", exact: true }).click();
    await expect(page.getByText("No changes detected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept displayed baseline" })).toBeDisabled();
    await db.monitor.update({
      where: { id: monitorId },
      data: {
        config: {
          baseline,
          latest: { ...latest, A: { state: "UNKNOWN", reason: "ETIMEOUT" } },
          observedAt: new Date().toISOString(),
        },
      },
    });
    await page.reload();
    await page.getByText("DNS records and baseline", { exact: true }).click();
    await expect(page.getByText(/Your baseline is preserved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept displayed baseline" })).toBeDisabled();
    await page
      .locator("details")
      .filter({ hasText: "DNS records and baseline" })
      .screenshot({ path: testInfo.outputPath("dns-unavailable.png") });
    await db.monitor.update({ where: { id: monitorId }, data: { config: {} } });
    await page.reload();
    await page.getByText("DNS records and baseline", { exact: true }).click();
    await expect(page.getByText("Waiting for the first DNS check.")).toBeVisible();
    await page
      .locator("details")
      .filter({ hasText: "DNS records and baseline" })
      .screenshot({ path: testInfo.outputPath("dns-empty.png") });
    await page.goto("/settings/alerts");
    const channel = page.getByRole("switch", { name: "In-app notifications", exact: true });
    await expect(channel).toBeEnabled();
    const original = await channel.getAttribute("aria-checked");
    await channel.click();
    await expect(channel).toHaveAttribute("aria-checked", original === "true" ? "false" : "true");
    await expect(page.getByText("Your notification preference was saved.")).toBeVisible();
    await page.getByLabel("Acknowledge within (minutes)").fill("45");
    await page.getByRole("button", { name: "Save SLA policy", exact: true }).click();
    await expect(page.getByText("Organization SLA policy saved.")).toBeVisible();
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to dashboard content" })).toBeFocused();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/v1/organizations/${organizationId}/monitors`, async (route) => {
      await gate;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"QA unavailable fixture"}',
      });
    });
    try {
      await page.goto("/dashboard");
      await expect(page.getByText("Loading monitoring checks…", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("monitor-loading.png"), fullPage: true });
    } finally {
      release();
    }
    await expect(page.getByText(/Unable to load monitors/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("monitor-error.png"), fullPage: true });
    await page.unrouteAll({ behavior: "wait" });
    expect(errors).toEqual([]);
  });
}
