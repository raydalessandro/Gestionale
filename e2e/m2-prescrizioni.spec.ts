import { expect, test, type Page } from "@playwright/test";
import { creaCliente, registraTenant, unico } from "./_helpers";

/**
 * L3 · M2 Prescrizioni — soltanto S1–S8, S11 e S12.
 * S9–S10 (prove e campioni LAC) sono esplicitamente nel filone Y/M5 per la
 * decisione Fable del 12/08, recepita in M2 §10 annotazione 4.
 */
async function apriScheda(page: Page, clienteId: string) {
  await page.goto(`/clienti/${clienteId}/prescrizioni/nuova`);
  await page.getByRole("checkbox", { name: /acconsente al trattamento dei dati sanitari/i }).check();
}

async function salva(page: Page) {
  await page.getByRole("button", { name: "Salva e chiudi" }).click();
  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
}

async function compilaOcchiali(page: Page, dati: { od?: string; os?: string; add?: string } = {}) {
  await page.getByLabel("OD sfero").fill(dati.od ?? "-2.00");
  await page.getByLabel("OS sfero").fill(dati.os ?? "-2.00");
  if (dati.add) {
    await page.getByLabel("OD addizione").fill(dati.add);
    await page.getByLabel("OS addizione").fill(dati.add);
  }
}

async function compilaLac(page: Page) {
  await page.getByRole("checkbox", { name: "Sezione LAC" }).check();
  await page.getByLabel("LAC OD visus corretto").fill("10/10");
  await page.getByLabel("LAC OS visus corretto").fill("10/10");
}

test.describe("M2 · Prescrizioni (§8 · S1–S8, S11–S12)", () => {
  test("S1 · scheda unica check-up: Occhiali e LAC insieme", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Sara", cognome: `Uno ${unico()}` });
    await apriScheda(page, clienteId);
    await compilaOcchiali(page);
    await compilaLac(page);
    await salva(page);
    await expect(page.getByText("Occhiali", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("LAC", { exact: true }).first()).toBeVisible();
  });

  test("S2 · office usa lontano+ADD e non genera un intermedio automatico", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Sergio", cognome: `Due ${unico()}` });
    await apriScheda(page, clienteId);
    await page.getByLabel("Tipologia Occhiali").selectOption("office");
    await compilaOcchiali(page, { od: "-2", os: "-1.5", add: "2" });
    await expect(page.getByText(/derivata \+0\.00/)).toBeVisible();
    await salva(page);
    await expect(page.getByText("Office", { exact: true })).toBeVisible();
  });

  test("S3 · conversione occhiali→LAC oltre ±4 D, modificabile", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Marta", cognome: `Tre ${unico()}` });
    await apriScheda(page, clienteId);
    await compilaOcchiali(page, { od: "-5.50", os: "-3.00" });
    await expect(page.getByText(/OD LAC proposta dopo vertice: −5\.16/)).toBeVisible();
    await compilaLac(page);
    await page.getByLabel("LAC OD visus corretto").fill("9/10");
    await salva(page);
    await expect(page.getByText("LAC", { exact: true }).first()).toBeVisible();
  });

  test("S4 · ricetta oculistica: inserimento al volo e selezione successiva", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Paola", cognome: `Quattro ${unico()}` });
    await apriScheda(page, clienteId);
    await page.getByLabel("Origine").selectOption("ricetta_oculistica");
    await page.getByLabel("Oculista — inserisci al volo").fill("Dott. Rinaldi");
    await compilaOcchiali(page);
    await salva(page);

    await apriScheda(page, clienteId);
    await page.getByLabel("Origine").selectOption("ricetta_oculistica");
    await expect(page.getByLabel("Oculista già in registro")).toContainText("Dott. Rinaldi");
    await page.getByLabel("Oculista già in registro").selectOption({ label: /Dott\. Rinaldi/ });
    await compilaOcchiali(page, { od: "-1", os: "-1" });
    await salva(page);
    await expect(page.getByText("Ricetta oculistica", { exact: true })).toHaveCount(0);
  });

  test("S5 · mista: tipologie indipendenti per OD e OS", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Elena", cognome: `Cinque ${unico()}` });
    await apriScheda(page, clienteId);
    await page.getByLabel("Tipologia Occhiali").selectOption("mista");
    await page.getByLabel("Tipologia OD").selectOption("lontano");
    await page.getByLabel("Tipologia OS").selectOption("progressiva");
    await compilaOcchiali(page, { od: "0", os: "-2", add: "2" });
    await salva(page);
    await expect(page.getByText("Mista", { exact: true })).toBeVisible();
  });

  test("S6 · occhio invariato recupera l'ultima misurazione", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Irene", cognome: `Sei ${unico()}` });
    await apriScheda(page, clienteId);
    await compilaOcchiali(page, { od: "-2.25", os: "-1.00" });
    await salva(page);
    await apriScheda(page, clienteId);
    await page.getByRole("checkbox", { name: "OD invariato" }).check();
    await compilaOcchiali(page, { os: "-1.25" });
    await salva(page);
    await expect(page.getByText(/−2\.25/).first()).toBeVisible();
  });

  test("S7 · appaiamento intenzionale resta marcato", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Dario", cognome: `Sette ${unico()}` });
    await apriScheda(page, clienteId);
    await compilaOcchiali(page);
    await page.getByRole("checkbox", { name: "Appaiamento intenzionale" }).check();
    await salva(page);
    await expect(page.getByText("Occhiali", { exact: true }).first()).toBeVisible();
  });

  test("S8 · prisma conserva valore e base", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Nina", cognome: `Otto ${unico()}` });
    await apriScheda(page, clienteId);
    await compilaOcchiali(page);
    await page.getByLabel("Prisma OD").fill("1");
    await page.getByLabel("Base prisma OD").selectOption("interna");
    await salva(page);
    await expect(page.getByText(/base interna/)).toBeVisible();
  });

  test("S11 · plano da check-up è Rx valida con scadenza", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Piero", cognome: `Undici ${unico()}` });
    await apriScheda(page, clienteId);
    await page.getByRole("checkbox", { name: "Plano / nessuna correzione" }).check();
    await salva(page);
    await expect(page.getByText("Plano", { exact: true })).toBeVisible();
    await expect(page.getByText(/scade/)).toBeVisible();
  });

  test("S12 · LAC definitiva diretta senza percorso prove", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Luca", cognome: `Dodici ${unico()}` });
    await apriScheda(page, clienteId);
    await page.getByRole("checkbox", { name: "Sezione Occhiali" }).uncheck();
    await compilaLac(page);
    await salva(page);
    await expect(page.getByText("LAC", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Occhiali", { exact: true })).toHaveCount(0);
  });
});
