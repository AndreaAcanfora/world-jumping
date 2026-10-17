import { defineConfig, devices } from '@playwright/test';

const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:4174', locale: 'it-IT', launchOptions: { args: gl } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: gl } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: gl } } },
  ],
  webServer: { command: 'npx vite build && npx vite preview --port 4174 --strictPort', port: 4174, reuseExistingServer: !process.env.CI },
});
