import { test, expect } from "@playwright/test";
import { registraTenant, creaCliente, unico } from "./_helpers";

/**
 * L3 · Fase 2 — collaudo M3 S2, S3, S4, S5, S6 e S7. S1 resta in ATTESA:
 * la bolla automatica post-conferma fiscale è assegnata a B4 e non viene
 * simulata né implementata in B3. Scenari 1:1 da modulo-M3-magazzino.md §8.
 *
 * NB: i form magazzino usano input a solo placeholder e select "nudi": qui si
 * ripiega su getByPlaceholder / combobox. È un GANCIO richiesto (Field/aria) —
 * vedi report. Da validare contro l'app viva.
 */

/** Crea un prodotto LAC e ritorna il suo id (dall'URL di dettaglio). */
async function creaProdotto(
  page: import("@playwright/test").Page,
  nome: string,
  tipo: "lac" | "sole" | "montatura" = "lac"
): Promise<string> {
  await page.goto("/magazzino/prodotti/nuovo");
  await page.getByLabel("Tipo *").selectOption(tipo);
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
  test("S3 · Conta settimanale sole: Wayfarer mancante → rettifica furto B1", async ({ page }) => {
    await registraTenant(page);
    const prodId = await creaProdotto(page, `Wayfarer inventario ${unico()}`, "sole");

    await page.getByRole("button", { name: /Carico da bolla|Carica/ }).first().click();
    await page.getByPlaceholder("Q.tà in bolla").fill("2");
    await page.getByRole("button", { name: "Registra carico" }).click();
    await expect(page.getByTestId("numero-Giacenza")).toContainText("2");

    // Il titolare effettua la conta settimanale: la rettifica passa dal
    // cancello B1 `rettifiche_inventario`, con causale furto e storia leggibile.
    await page.getByRole("button", { name: "Rettifica" }).click();
    await page.getByLabel("direzione rettifica").selectOption("-");
    await page.getByLabel("causale rettifica").selectOption("furto");
    await page.getByPlaceholder("Quantità").fill("1");
    await page.getByPlaceholder("Motivo (obbligatorio)").fill("Conta settimanale: pezzo mancante");
    await page.getByRole("button", { name: "Registra rettifica" }).click();

    await expect(page.getByTestId("numero-Giacenza")).toContainText("1");
    await expect(page.getByText("Rettifica", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/causale furto/)).toBeVisible();
  });

  test("S4 · Ordine da catalogo → ponte consegna e incassa", async ({ page }) => {
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
    const creaOrdine = page.getByRole("button", { name: "Crea ordine" });
    await expect(creaOrdine).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/ordini\/lac\/[0-9a-f-]{36}$/),
      creaOrdine.click(),
    ]);

    // Il ponte verso la consegna esiste, ma l'incasso e lo scarico sono B5:
    // qui si verifica il passaggio, senza anticipare il modulo cassa.
    await page.getByRole("button", { name: "Segna ordinato" }).click();
    await page.getByRole("button", { name: "Segna arrivato" }).click();
    await expect(page.getByRole("link", { name: "Consegna e incassa" })).toHaveAttribute(
      "href",
      /^\/cassa\/vendita\/nuova\?lac=[0-9a-f-]{36}$/
    );
  });

  test("S6 · Pratica conformità con foto: riconosciuta → sostituzione, stock invariato", async ({ page }) => {
    await registraTenant(page);
    const prodId = await creaProdotto(page, `Tom Ford esposizione ${unico()}`, "sole");

    await page.getByRole("button", { name: /Carico da bolla|Carica/ }).first().click();
    await page.getByPlaceholder("Q.tà in bolla").fill("1");
    await page.getByRole("button", { name: "Registra carico" }).click();
    await expect(page.getByTestId("numero-Giacenza")).toContainText("1");

    await page.goto("/magazzino?vista=difetti");
    await page.getByRole("button", { name: "Apri pratica" }).click();
    await page.getByPlaceholder("Fornitore *").fill("Tom Ford");
    await page.getByLabel("Proprietà pratica difetto").selectOption("esposizione");
    await page.getByLabel("Prodotto pratica difetto").selectOption({ index: 1 });
    await page.getByPlaceholder("Descrizione del difetto *").fill("Asta difettosa alla consegna");
    await page.getByPlaceholder("Riferimenti foto, uno per riga").fill("foto-tom-ford-001.jpg");
    await page.getByRole("button", { name: "Apri pratica" }).click();
    await expect(page.getByText("1 foto-reference registrate")).toBeVisible();
    await expect(page.getByText("aperta", { exact: true })).toBeVisible();

    await page.getByLabel("Stato pratica difetto").selectOption("riconosciuta");
    await page.getByLabel("Esito pratica difetto").selectOption("sostituzione");
    await page.getByRole("button", { name: "Aggiorna" }).click();
    await expect(page.getByText("riconosciuta", { exact: true })).toBeVisible();

    await page.goto(`/magazzino/prodotti/${prodId}`);
    await expect(page.getByTestId("numero-Giacenza")).toContainText("1");
    await page.goto("/magazzino?vista=difetti");
    await page.getByLabel("Stato pratica difetto").selectOption("chiusa");
    await page.getByRole("button", { name: "Aggiorna" }).click();
    await expect(page.getByText("chiusa", { exact: true })).toBeVisible();
    await page.goto(`/magazzino/prodotti/${prodId}`);
    await expect(page.getByTestId("numero-Giacenza")).toContainText("1");
  });

  test("S7 · LAC non codificata: famiglia al volo → variante → riga bolla manuale", async ({ page }) => {
    await registraTenant(page);
    const famiglia = `Clariti test ${unico()}`;
    const variante = `${famiglia} -2.00`;

    await page.goto("/magazzino");
    await page.getByRole("button", { name: "Codifica famiglia" }).click();
    await page.getByPlaceholder("Fornitore *").fill("CooperVision");
    await page.getByPlaceholder("Nome famiglia *").fill(famiglia);
    await page.getByPlaceholder("BC disponibili, es. 8.4, 8.6").fill("8.6");
    await page.getByPlaceholder("DIA disponibili, es. 14.0, 14.2").fill("14.2");
    await page.getByRole("button", { name: "Salva famiglia" }).click();

    await page.goto("/magazzino/prodotti/nuovo");
    await page.getByLabel("Tipo *").selectOption("lac");
    await page.getByLabel("Nome *").fill(variante);
    await page.getByLabel("Prezzo (€) *").fill("24");
    // `toBeAttached`, NON `toBeVisible`: un `<option>` dentro un `<select>`
    // nativo non ha un box di layout proprio, quindi per Playwright è sempre
    // `hidden` — anche quando c'è, col testo giusto, ed è selezionabile. Qui si
    // vuole dire «la famiglia appena codificata è OFFERTA nella tendina», e la
    // presenza nel DOM è esattamente quel fatto (S7, prima esecuzione 17/08).
    await expect(page.getByLabel("Famiglia LAC").getByRole("option", { name: `CooperVision · ${famiglia}` })).toBeAttached();
    await page.getByLabel("Famiglia LAC").selectOption({ label: `CooperVision · ${famiglia}` });
    await page.getByRole("button", { name: "Crea prodotto" }).click();
    await page.waitForURL(/\/magazzino\/prodotti\/[0-9a-f-]{36}$/);
    const prodId = page.url().split("/").at(-1)!;
    await expect(page.getByTestId("numero-Giacenza")).toContainText("0");

    // S1 resta fuori: qui la bolla è inserita a mano come la fornitura S2;
    // il trigger automatico post-conferma fiscale sarà B4.
    await page.goto("/magazzino?vista=ricevimenti");
    await page.getByRole("button", { name: "Nuova bolla attesa" }).click();
    await page.getByPlaceholder("Fornitore *").fill("CooperVision");
    await page.getByPlaceholder("N° bolla").fill("LAC-S7-001");
    await page.getByLabel("Prodotto riga bolla").selectOption({ label: variante });
    await page.getByPlaceholder("Quantità attesa *").fill("2");
    await page.getByRole("button", { name: "Crea bolla attesa" }).click();
    await expect(page.getByText(variante, { exact: true })).toBeVisible();
    await expect(page.getByText("Attesa 2 · confermata 0 · da confermare 2")).toBeVisible();
    await page.goto(`/magazzino/prodotti/${prodId}`);
    await expect(page.getByTestId("numero-Giacenza")).toContainText("0");
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
