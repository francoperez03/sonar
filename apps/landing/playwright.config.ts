import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
  ],
});
