import { test, expect } from "@playwright/test";
import { registraTenant, creaCliente } from "./_helpers";

/**
 * L3 · Fase 2 — collaudo S2 (carico con differenza → due movimenti),
 * S4 (Da catalogo → consegna → scarico), S5 (fermo: ritiro scarica, annullo
 * no). Scenari 1:1 da docs/fasi/fase-2-catalogo-magazzino.md §7.
 *
 * NB: i form magazzino usano input a solo placeholder e select "nudi": qui si
 * ripiega su getByPlaceholder / combobox. È un GANCIO richiesto (Field/aria) —
 * vedi report. Da validare contro l'app viva.
 */

/** Crea un prodotto LAC e ritorna il suo id (dall'URL di dettaglio). */
async function creaProdotto(page: import("@playwright/test").Page, nome: string): Promise<string> {
  await page.goto("/magazzino/prodotti/nuovo");
  await page.getByLabel("Tipo *").selectOption("lac");
  await page.getByLabel("Nome *").fill(nome);
  await page.getByLabel("Prezzo (€) *").fill("20");
  await page.getByRole("button", { name: "Crea prodotto" }).click();
  await page.waitForURL(/\/magazzino\/prodotti\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

test.describe("Fase 2 · Catalogo & Magazzino", () => {
  test("S2 · Carico da bolla con sorpresa: giacenza 9, carico +10 e rettifica −1", async ({ page }) => {
    await registraTenant(page);
    const prodId = await creaProdotto(page, "Oasys 1-Day 30pz");

    // Apre il pannello "Carico da bolla" (bottone in scheda prodotto).
    await page.getByRole("button", { name: /Carico da bolla|Carica/ }).first().click();
    await page.getByPlaceholder("N° bolla").fill("123");
    await page.getByPlaceholder("Q.tà in bolla").fill("10");
    await page.getByPlaceholder("Q.tà contata").fill("9");
    await page.getByRole("button", { name: "Registra carico" }).click();

    await expect(page.getByTestId("numero-Giacenza")).toContainText("9");
    // La voce-movimento è esattamente "Carico" (etichettaMovimento): exact per
    // non riprendere bottone "Carico da bolla"/titolo/"Registra carico".
    await expect(page.getByText("Carico", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Differenza da bolla 123/)).toBeVisible();
  });

  // B3 · diagnosi obbligatoria: questo scenario era stato sospeso per un timeout
  // nel wizard LAC «Da catalogo». Prima di modificare wizard o consegna, eseguirlo
  // in CI e leggere il trace: la causa può essere un selettore, il debounce di
  // catalogo o una regressione reale, ma non si decide a memoria. Lo scarico alla
  // consegna resta coperto anche dal contratto magazzino-trigger.
  test("S4 · Ordine da catalogo → consegna → scarico ordine_cliente", async ({ page }) => {
    await registraTenant(page);
    const prodId = await creaProdotto(page, "Biofinity ×6");
    const clienteId = await creaCliente(page, { nome: "Anna", cognome: "Gialli" });

    // Carico iniziale +10 così alla consegna si vede lo scarico.
    await page.goto(`/magazzino/prodotti/${prodId}`);
    await page.getByRole("button", { name: /Carico da bolla|Carica/ }).first().click();
    await page.getByPlaceholder("Q.tà in bolla").fill("10");
    await page.getByRole("button", { name: "Registra carico" }).click();
    await expect(page.getByTestId("numero-Giacenza")).toContainText("10");

    // Ordine LAC "Da catalogo".
    await page.goto(`/ordini/lac/nuovo?cliente=${clienteId}`);
    await page.getByRole("button", { name: "Da catalogo" }).click();
    await page.getByPlaceholder(/Cerca LAC o soluzione/).fill("Biofinity");
    await page.getByRole("button", { name: /Biofinity/ }).click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Crea ordine" }).click();
    await page.waitForURL(/\/ordini\/lac\/[0-9a-f-]{36}$/);

    // Porta fino a consegna.
    await page.getByRole("button", { name: "Segna ordinato" }).click();
    await page.getByRole("button", { name: "Segna arrivato" }).click();
    await page.getByRole("button", { name: "Consegna" }).click();
    await expect(page.getByText("Consegnato", { exact: false })).toBeVisible();

    // La giacenza è scesa a 9 e c'è un movimento ordine_cliente col numero OL.
    await page.goto(`/magazzino/prodotti/${prodId}`);
    await expect(page.getByTestId("numero-Giacenza")).toContainText("9");
    await expect(page.getByText(/OL-\d{4}-\d{4}/)).toBeVisible();
  });

  test("S5 · Fermo: ritiro scarica, annullo non muove nulla", async ({ page }) => {
    await registraTenant(page);
    const prodId = await creaProdotto(page, "Persol 649");
    await creaCliente(page, { nome: "Elsa", cognome: "Blu" });

    await page.goto(`/magazzino/prodotti/${prodId}`);
    await page.getByRole("button", { name: /Carico da bolla|Carica/ }).first().click();
    await page.getByPlaceholder("Q.tà in bolla").fill("3");
    await page.getByRole("button", { name: "Registra carico" }).click();
    await expect(page.getByTestId("numero-Giacenza")).toContainText("3");

    // Nuovo fermo per il cliente.
    await page.getByRole("button", { name: "Nuovo fermo" }).first().click();
    await page.getByPlaceholder(/Cerca cliente/i).fill("Blu");
    await page.getByRole("button", { name: /Blu/ }).first().click();
    await page.getByPlaceholder(/Quantità|Q\.tà/).first().fill("1");
    await page.getByRole("button", { name: /Ferma|Crea fermo|Metti da parte/ }).click();

    // Ritiro → scarico della giacenza e chiusura del fermo. La lista "Fermi
    // attivi" filtra stato='attivo' (page.tsx) e `eventoFermo(…,'ritira')` porta
    // il fermo a 'ritirato' + un movimento scarico (actions.ts): quindi la pill
    // "Ritirato" NON compare qui — il fermo esce dalla lista. È il comportamento
    // giusto; lo scenario intende «ritiro scarica», e questo si verifica così:
    //   • il fermo attivo è sparito (non più in lista);
    //   • la giacenza è scesa da 3 a 2 (l'1 pz ritirato è uscito).
    await page.getByRole("button", { name: "Segna ritirato" }).click();
    await expect(page.getByText("Nessun fermo attivo.")).toBeVisible();
    await expect(page.getByTestId("numero-Giacenza")).toContainText("2");
  });
});
