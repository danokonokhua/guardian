import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 240000,
  use: { baseURL: process.env.QA_BASE_URL ?? "http://localhost:3001", browserName: "chromium" },
  reporter: [["list"], ["html", { open: "never" }]],
});
