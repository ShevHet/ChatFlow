import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

// Используем системную временную папку для избежания проблем с OneDrive
const testResultsDir = path.join(os.tmpdir(), 'playwright-test-results');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  outputDir: testResultsDir,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // Автоматический запуск сервера
  // Если сервер уже запущен, Playwright использует его (reuseExistingServer)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300000, // 5 минут для первого запуска
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

