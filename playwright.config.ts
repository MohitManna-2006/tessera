import { defineConfig, devices } from "@playwright/test";

const requestedPort = Number.parseInt(
  process.env.PLAYWRIGHT_PORT ?? "3000",
  10,
);
const port =
  Number.isInteger(requestedPort) &&
  requestedPort >= 1_024 &&
  requestedPort <= 65_535
    ? requestedPort
    : 3_000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: `AI_RESUME_EXTRACTION_ENABLED=true OPENAI_API_KEY=playwright-test-key OPENAI_RESUME_MODEL=playwright-mocked-model npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer:
      !process.env.CI && process.env.PLAYWRIGHT_PORT === undefined,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
