import { test, expect } from "@playwright/test";
import { registraTenant, creaCliente } from "./_helpers";

/**
 * L3 · Fase 1 — collaudo S1 (LAC dalla Rx alla consegna) e S2 (busta:
 * ispezione obbligatoria, consegna col saldo). Scenari 1:1 dalla spec
 * docs/fasi/fase-1-ordini-buste.md §8.
 *
 * NB: ogni test parte dalla registrazione (tenant usa-e-getta). I selettori
 * sono per ruolo/etichetta/testo. Vanno validati contro l'app viva (i wizard
 * multi-step e la ricerca cliente sono i punti più sensibili) — vedi report.
 */

test.describe("Fase 1 · Ordini & Buste", () => {
  test("S1 · LAC dal banco: dalla Rx alla consegna", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Giulia", cognome: "Neri", telefono: "3331112222" });

    // Prescrizione LAC del cliente (serve a "Da prescrizione").
    await page.goto(`/clienti/${clienteId}/prescrizioni/nuova`);
    await page.getByLabel(/Tipo/).first().selectOption("lac");
    await page.getByRole("button", { name: "Salva prescrizione" }).click();
    await page.waitForURL(new RegExp(`/clienti/${clienteId}$`));

    // Wizard ordine LAC: con ?cliente parte dal passo "righe".
    await page.goto(`/ordini/lac/nuovo?cliente=${clienteId}`);
    await page.getByRole("button", { name: "Da prescrizione" }).click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Crea ordine" }).click();

    // Dettaglio ordine: numero OL-AAAA-NNNN e macchina a stati.
    await page.waitForURL(/\/ordini\/lac\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/OL-\d{4}-\d{4}/)).toBeVisible();

    await page.getByRole("button", { name: "Segna ordinato" }).click();
    await page.getByRole("button", { name: "Segna arrivato" }).click();
    await page.getByRole("button", { name: "Segna avvisato" }).click();
    await page.getByRole("button", { name: "Consegna" }).click();

    await expect(page.getByText("Consegnato", { exact: false })).toBeVisible();
  });

  test("S2 · Busta: niente pronta senza ispezione, consegna col saldo", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, { nome: "Marco", cognome: "Verdi" });

    // Wizard busta (6 passi): con ?cliente parte dal passo 2.
    await page.goto(`/ordini/buste/nuova?cliente=${clienteId}`);
    await page.getByLabel("Tipo lente").selectOption("progressiva").catch(() => undefined);
    await page.getByLabel("Prezzo lenti (€)").fill("300");
    // Avanza fino al passo 6 (riepilogo) e crea in lavorazione.
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Crea busta" }).click();

    await page.waitForURL(/\/ordini\/buste\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/BL-\d{4}-\d{4}/)).toBeVisible();

    // Arrivata dal laboratorio: l'UNICA via verso "pronta" è l'ispezione.
    await page.getByRole("button", { name: "Segna arrivata" }).click();
    await expect(page.getByRole("button", { name: "Ispeziona e segna pronta" })).toBeVisible();
    // Non deve esistere un modo di saltare l'ispezione:
    await expect(page.getByRole("button", { name: /^Segna pronta$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Ispeziona e segna pronta" }).click();
    await expect(page.getByText("Pronta", { exact: false })).toBeVisible();

    // Consegna: apre il riepilogo saldo, poi conferma.
    await page.getByRole("button", { name: "Consegna" }).click();
    await page.getByRole("button", { name: "Conferma consegna" }).click();
    await expect(page.getByText("Consegnata", { exact: false })).toBeVisible();
  });
});
