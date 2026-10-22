import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm --filter @city/web preview --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // The lobby spec runs against the assembled static site, not the Urbe dev build.
      // Vite lives in the app packages, not at the workspace root, so call it from one of them.
      command: `pnpm build:site && pnpm --filter @plot42/lobby exec vite preview --outDir ../../site --port 4180 --strictPort`,
      port: 4180,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      // Neo Urbe runs on its own port so the shared Urbe server stays untouched.
      command: `pnpm --filter @neon/web build && pnpm --filter @neon/web preview --port 5179 --strictPort`,
      port: 5179,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
