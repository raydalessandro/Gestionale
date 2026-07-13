import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright (L3 · E2E) per VISTA.
 *
 * Ambiente: un'app Next locale (`next start` dopo `next build`, o `next dev`)
 * puntata al progetto Supabase di TEST — mai produzione. Le stesse env del L2
 * servono all'app, non ai test: qui basta la baseURL.
 *
 * Regole di stabilità:
 *   • Solo chromium (i browser sono già installati in CI via cache).
 *   • workers = 1: ogni test crea il SUO tenant, ma la registrazione tocca lo
 *     stato di sessione del browser; serializzare toglie ambiguità e flakiness.
 *   • Nessuno sleep fisso nei test: solo attese su condizioni (auto-waiting).
 */
const PORT = process.env.PORT ?? "3000";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    // La UI è in italiano: coerenza per i formattatori Intl nei test.
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // In CI l'app viene avviata dal workflow prima di Playwright; in locale, se
  // non c'è già un server, Playwright lo avvia. reuseExistingServer evita
  // doppie istanze quando lo si tiene aperto a mano.
  webServer: {
    command: process.env.E2E_WEB_COMMAND ?? "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
