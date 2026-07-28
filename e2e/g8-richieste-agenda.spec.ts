import { test, expect, type Page } from "@playwright/test";
import { registraTenant, creaCliente } from "./_helpers";

/**
 * L3 · E2E — Consegna G8 · Le richieste dentro l'agenda.
 *
 * ── §1 · CARATTERIZZAZIONE del flusso appuntamenti ESISTENTE ────────────────
 * Prima di toccare l'agenda: la rete che descrive com'è OGGI. Il modulo aveva
 * copertura E2E zero sul flusso appuntamenti (le prove di fase 3 riguardano i
 * richiami). Questi test devono restare VERDI dopo le modifiche G8: sono la
 * guardia di non-regressione dell'agenda che l'ottico usa già.
 *
 * Solo UI, nessun service role: girano ovunque giri l'app contro il DB di test.
 *
 * NOTA sul modello (riportata nella PR): l'annulla inline dell'agenda NON
 * raccoglie un motivo (il bottone è un form nudo; `eventoAppuntamento` lo
 * accetterebbe, ma la UI non lo espone — a differenza di ordini/buste). La
 * caratterizzazione verifica quindi la transizione a «Annullato», non il motivo
 * nelle note: non c'è modo, dalla UI di oggi, di fornirlo. Non è una regressione,
 * è un pezzo di UI mai costruito.
 *
 * Gli scenari del NUOVO comportamento (§2–§6, striscia sospesi, accetta/rifiuta,
 * prendi come cliente, giro completo portale→agenda) li aggiunge l'agente-test.
 */

/** Crea un appuntamento dalla UI del gestionale; lascia la pagina sull'agenda del giorno. */
async function creaAppuntamentoUI(
  page: Page,
  opts: { data: string; ora?: string; tipoLabel?: string; clienteId?: string } // clienteId → preseleziona
): Promise<void> {
  const q = new URLSearchParams({ data: opts.data });
  if (opts.clienteId) q.set("cliente", opts.clienteId);
  await page.goto(`/agenda/nuovo?${q.toString()}`);
  if (opts.tipoLabel) {
    await page.getByLabel("Tipo").selectOption({ label: opts.tipoLabel });
  }
  await page.getByLabel("Ora").fill(opts.ora ?? "10:00");
  await page.getByRole("button", { name: "Salva appuntamento" }).click();
  await page.waitForURL(/\/agenda\?data=/);
}

test.describe("G8 · §1 · Caratterizzazione flusso appuntamenti (com'è oggi)", () => {
  const OGGI = new Date().toISOString().slice(0, 10);

  test("Creato dal gestionale → compare in agenda come «Prenotato»", async ({ page }) => {
    await registraTenant(page);
    const clienteId = await creaCliente(page, {
      nome: "Anna",
      cognome: "Verdi",
      telefono: "3401110001",
    });

    await creaAppuntamentoUI(page, { data: OGGI, ora: "10:00", tipoLabel: "Controllo vista", clienteId });

    // La riga: badge del tipo, nome del cliente, pillola «Prenotato», le tre azioni.
    await expect(page.getByText("Controllo vista").first()).toBeVisible();
    await expect(page.getByText("Verdi Anna")).toBeVisible();
    await expect(page.getByText("Prenotato", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completato" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Non presentato" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Annulla" })).toBeVisible();
  });

  test("Completa → «Completato», sparisce dai bottoni d'azione", async ({ page }) => {
    await registraTenant(page);
    await creaAppuntamentoUI(page, { data: OGGI, ora: "10:30", tipoLabel: "Controllo vista" });

    await page.getByRole("button", { name: "Completato" }).click();

    await expect(page.getByText("Completato", { exact: true })).toBeVisible();
    // Stato finale: niente più azioni sulla riga.
    await expect(page.getByRole("button", { name: "Completato" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Annulla" })).toHaveCount(0);
  });

  test("Non presentato → «Non presentato»", async ({ page }) => {
    await registraTenant(page);
    await creaAppuntamentoUI(page, { data: OGGI, ora: "11:00", tipoLabel: "Controllo vista" });

    await page.getByRole("button", { name: "Non presentato" }).click();

    // La pillola dello stato mancato riporta «Non presentato» (STATI_APPUNTAMENTO).
    await expect(page.getByText("Non presentato", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completato" })).toHaveCount(0);
  });

  test("Annulla → «Annullato» (la UI di oggi non chiede un motivo)", async ({ page }) => {
    await registraTenant(page);
    await creaAppuntamentoUI(page, { data: OGGI, ora: "11:30", tipoLabel: "Controllo vista" });

    await page.getByRole("button", { name: "Annulla" }).click();

    await expect(page.getByText("Annullato", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completato" })).toHaveCount(0);
  });
});
