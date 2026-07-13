import { test, expect } from "@playwright/test";
import {
  registraTenant,
  creaCliente,
  aziendaIdDaSlug,
  seedBustaProntaConAcconto,
} from "./_helpers";

/**
 * L3 · Fase 4 — collaudo Cassa & Vendite (docs/fasi/fase-4-cassa.md §7).
 * Scenari 1:1: S1 (vendita veloce col resto), S3 (consegna con caparra + doppio
 * incasso rifiutato), S6 (reso con causale), S8 (chiusura con causale oltre 0,05).
 *
 * Selettori: SOLO ruolo/etichetta/testo. Dove il wizard vendita espone solo
 * placeholder/aria-label (descrizione, importi, metodo, aliquota) si usano
 * getByPlaceholder/getByLabel — vedi "ganci richiesti" in report-test.md.
 *
 * Da validare contro l'app viva al primo giro CI (wizard multi-step).
 */

/** Compone una vendita veloce dalla UI. Lascia la pagina sul dettaglio vendita. */
async function venditaVeloce(
  page: import("@playwright/test").Page,
  opts: { descrizione: string; prezzo: string; metodo: string; consegnato?: string }
): Promise<void> {
  await page.goto("/cassa");
  await page.getByRole("link", { name: "Vendita veloce" }).first().click();
  await page.waitForURL("**/cassa/vendita/nuova");

  await page.getByPlaceholder("Descrizione").fill(opts.descrizione);
  await page.getByLabel("prezzo unitario").fill(opts.prezzo);

  // Pagamento: metodo + importo pari al totale (così "quadra").
  await page.getByLabel("metodo").first().selectOption({ label: opts.metodo });
  await page.getByLabel("importo").first().fill(opts.prezzo);
  if (opts.consegnato !== undefined) {
    await page.getByLabel("consegnato").fill(opts.consegnato);
  }

  await page.getByRole("button", { name: "Registra vendita" }).click();
  await page.waitForURL(/\/cassa\/vendite\/[0-9a-f-]{36}$/);
}

test.describe("Fase 4 · Cassa & Vendite", () => {
  test("S1 · Vendita veloce anonima, contanti col resto a video", async ({ page }) => {
    await registraTenant(page);

    await page.goto("/cassa/vendita/nuova");
    await page.getByPlaceholder("Descrizione").fill("Occhiale da sole");
    await page.getByLabel("prezzo unitario").fill("158");
    // Aliquota 22% (default), pagamento contanti con resto.
    await page.getByLabel("metodo").first().selectOption({ label: "Contanti" });
    await page.getByLabel("importo").first().fill("158");
    await page.getByLabel("consegnato").fill("200");
    // Il resto (42) appare a video accanto al campo "Consegnato".
    await expect(page.getByText(/resto/i)).toContainText("42");

    await page.getByRole("button", { name: "Registra vendita" }).click();
    await page.waitForURL(/\/cassa\/vendite\/[0-9a-f-]{36}$/);

    // Vendita "Non associato" con numero VE.
    await expect(page.getByText("Non associato")).toBeVisible();
    await expect(page.getByText(/VE-\d{4}-\d{4}/)).toBeVisible();
  });

  test("S3 · Consegna con caparra: intero valore, un solo incasso", async ({ page }) => {
    test.skip(
      !process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
      "La busta 'pronta' con acconto va retrodatata via service role."
    );
    const { slug } = await registraTenant(page);
    const aziendaId = await aziendaIdDaSlug(slug);
    const clienteId = await creaCliente(page, { nome: "Elsa", cognome: "Neri", telefono: "3331112222" });
    const { id: bustaId, numero } = await seedBustaProntaConAcconto(aziendaId, clienteId, {
      totale: 965,
      acconto: 780,
    });

    // Dalla scheda busta: "Consegna e incassa" (il modulo cassa è attivo).
    await page.goto(`/ordini/buste/${bustaId}`);
    await page.getByRole("link", { name: "Consegna e incassa" }).click();
    await page.waitForURL(/\/cassa\/vendita\/nuova\?busta=/);

    // La caparra è precompilata; completo il saldo (965 − 780 = 185) con Mastercard.
    await expect(page.getByText(/di cui IVA/i)).toBeVisible();
    await page.getByLabel("metodo").last().selectOption({ label: "Mastercard" });
    await page.getByLabel("importo").last().fill("185");

    await page.getByRole("button", { name: "Consegna e incassa" }).click();
    await page.waitForURL(/\/cassa\/vendite\/[0-9a-f-]{36}$/);
    // La vendita è per l'INTERO valore (965), non per il solo saldo.
    await expect(page.getByText("965", { exact: false })).toBeVisible();

    // Riprovare l'incasso dello stesso ordine → rifiutato dall'indice unico.
    await page.goto(`/cassa/vendita/nuova?busta=${bustaId}`);
    await page.getByRole("button", { name: "Consegna e incassa" }).click();
    await expect(page.getByText(/gi[àa] una vendita|gi[àa] incassat/i)).toBeVisible();

    // Riferimento busta ancora leggibile (contesto).
    expect(numero).toMatch(/^BL-/);
  });

  test("S6 · Reso con causale sulla vendita veloce", async ({ page }) => {
    await registraTenant(page);
    await venditaVeloce(page, { descrizione: "Occhiale da sole", prezzo: "158", metodo: "Contanti" });

    // Dal dettaglio vendita: registra un reso denaro con causale.
    await page.getByRole("button", { name: "Registra reso" }).first().click();
    await page.getByLabel("tipo reso").selectOption({ label: "Reso con rimborso (denaro)" });
    await page.getByLabel("causale").selectOption({ label: "Soddisfatti o rimborsati" });
    await page.getByRole("button", { name: /Registra reso/ }).click();

    // La vendita resta emessa; il reso RE- compare nel registro.
    await page.goto("/cassa/resi");
    await expect(page.getByText(/RE-\d{4}-\d{4}/)).toBeVisible();
    await expect(page.getByText("Soddisfatti o rimborsati")).toBeVisible();
  });

  test("S8 · Chiusura serale: eccedenza contanti oltre 0,05 pretende la causale", async ({ page }) => {
    await registraTenant(page);
    // Una vendita contanti da 100 → sistema contanti del giorno = 100.
    await venditaVeloce(page, { descrizione: "Servizio", prezzo: "100", metodo: "Contanti" });

    await page.goto("/cassa");
    await page.getByRole("link", { name: "Chiudi la giornata" }).click();
    await page.waitForURL("**/cassa/chiusura");

    // Contanti contati = fondo(300) + incasso(100) + 1 € di eccedenza.
    await page.getByLabel("dichiarato Contanti").first().fill("401");
    // Oltre 0,05 → compare il campo causale, obbligatorio lato server.
    await page.getByLabel("causale Contanti").fill("Fondo cassa in eccesso");

    await page.getByRole("button", { name: "Chiudi la giornata" }).click();
    // Una sola chiusura per oggi → si atterra sul suo dettaglio.
    await page.waitForURL(/\/cassa\/chiusure\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/versamento/i)).toBeVisible();
  });
});
