import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:8080", headless: true },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --force --mode test --host 127.0.0.1",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_SUPABASE_URL: "https://offline.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "offline-test-public-key",
      VITE_PREDICTOR_EXTERNAL_ENABLED: "true",
    },
  },
  reporter: "list",
  timeout: 60000,
});
