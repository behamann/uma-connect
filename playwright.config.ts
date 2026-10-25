import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", testIgnore: "accounts/**", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testIgnore: "accounts/**", use: { ...devices["Pixel 7"] } },
    // Needs the local Supabase stack (npm run db:start) and its values in the build env.
    { name: "accounts", testDir: "tests/e2e/accounts", fullyParallel: false, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npx serve out -l ${PORT} --no-clipboard`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
