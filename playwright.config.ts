import { defineConfig, devices } from "@playwright/test";

/**
 * Needs the local Supabase stack running and seeded:
 *   npx supabase start && npm run db:seed
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // Logins share test phone numbers, and OTP sending is rate-limited per number.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    // Numbers count up on Today; tests read the final value straight away.
    contextOptions: { reducedMotion: "reduce" },
    // Lets a machine with a pre-installed Chromium use it (e.g. PW_CHROMIUM_PATH=/opt/pw-browsers/chromium).
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/welcome",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
