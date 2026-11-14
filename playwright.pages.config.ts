import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages.spec.ts",
  reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "on-first-retry" },
});
