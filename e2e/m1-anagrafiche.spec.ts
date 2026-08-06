import { test, expect } from "@playwright/test";
import {
  registraTenant,
  creaCliente,
  dammiConsensoMarketing,
  revocaConsensoMarketing,
  rigaMarketing,
  righeMastroMarketing,
  unico,
} from "./_helpers";

/**
 * L3 · E2E — **M1 · Anagrafiche & Privacy**, gli scenari del §8 della spec, per
 * nome: S1 … S6. (**S7 è CROSS-MODULO**: vendita veloce LAC col CF — si collauda
 * in B5/M8, non qui: lo dice la spec stessa.)
 *
 * ── STATO (consegna B1, secondo giro) ────────────────────────────────────────
 * Alla prima stesura tutti e sei erano `test.fixme`: la «UI minima» del §4 non
 * era agganciata e i nomi qui dentro erano la lettura della SPEC, non un
 * contratto con la UI. **Ora la UI c'è** (`components/PermessiCliente.tsx`
 * montato da `app/(app)/clienti/[id]/page.tsx`, blocco «Sconti e fatturazione»
 * in `ClienteForm`), quindi i selettori sono stati riportati su ciò che il
 * sorgente RENDE DAVVERO — non il contrario — e cinque scenari sono vivi:
 *   S1 ✅ · S2 ✅ · S3 ✅ · S4 ✅ · S5 metà ✅ / metà `fixme` · S6 ✅
 * L'unico `fixme` rimasto è la **seconda metà di S5**: lo sconto assicurativo in
 * cassa è M8 e non esiste ancora (il campo assicurazione, che era l'altro
 * blocco, c'è: la prima metà lo collauda).
 *
 * ── Due regole di scrittura, imparate a spese di questo file ─────────────────
 * 1. **Strict mode**: `getByRole(name:)` e `getByText("…")` fanno match di
 *    SOTTOSTRINGA. Le asserzioni «c'è scritto email da qualche parte» oggi
 *    pescherebbero insieme la riga di cache, la riga del mastro e l'etichetta
 *    del checkbox. Qui si àncora sempre: regex con `^`/`$`, `exact: true`,
 *    `.filter()` sulla lista del mastro.
 * 2. **La riga «Marketing: …» è UNA SOLA in tutta la pagina** (sezione
 *    Permessi) ed è la CACHE del contratto C3; il mastro sotto sono i FATTI. Le
 *    due cose si asseriscono con due locatori diversi (`rigaMarketing` e
 *    `righeMastroMarketing` in `_helpers`), mai con un `getByText` generico.
 *
 * Selettori: solo ruolo/etichetta/testo. Ogni test crea il SUO tenant
 * usa-e-getta (`registraTenant`), nessuno dipende dagli altri.
 */

test.describe("M1 · Anagrafiche & Privacy (§8 · S1-S6)", () => {
  /* ── S1 ─────────────────────────────────────────────────────────────────
   * «scheda completa stile racconto, con blocco P.IVA»
   * Copre f1a 1→6: identità, recapiti, indirizzo, requisiti sconti
   * (assicurazione «da rilevare» → NESSUNA) e i dati di fatturazione jsonb.
   * ------------------------------------------------------------------- */
  test("S1 · scheda completa con blocco P.IVA", async ({ page }) => {
    await registraTenant(page);
    const id = unico();

    await page.goto("/clienti/nuovo");
    // Identità
    await page.getByLabel(/^Nome \*$/).fill("Laura");
    await page.getByLabel("Secondo nome").fill("Maria");
    await page.getByLabel(/^Cognome \*$/).fill(`Bianchi ${id}`);
    await page.getByLabel("Data di nascita").fill("1985-08-10");
    await page.getByLabel("Codice fiscale").fill("BNCLRA85M50F205Z");
    // Recapiti (email FACOLTATIVA e mai fittizia: qui la compiliamo davvero)
    await page.getByLabel("Cellulare", { exact: true }).fill("+39 333 1234567");
    await page.getByLabel("Email").fill(`laura.${id}@esempio.it`);
    await page.getByLabel("Tel. casa").fill("02 1234567");
    // Indirizzo
    await page.getByLabel("Via").fill("Via Roma 12");
    await page.getByLabel("Scala / appartamento").fill("Scala B, interno 4");
    await page.getByLabel("Città").fill("Milano");
    await page.getByLabel("CAP").fill("20100");
    await page.getByLabel("Prov.").fill("MI");
    // Sconti e fatturazione (M1 §2: null = da rilevare · NESSUNA = chiesto, non
    // ne ha). La voce NESSUNA la semina la 021: c'è in ogni negozio nuovo.
    await page.getByLabel("Assicurazione").selectOption({ label: "NESSUNA" });
    await page.getByLabel("Ragione sociale").fill("Bianchi SRL");
    await page.getByLabel("CF / P.IVA azienda").fill("12345678901");
    await page.getByLabel("Codice SDI").fill("ABCDEFG");

    await page.getByRole("button", { name: "Crea cliente" }).click();
    await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
    const clienteId = page.url().split("/").at(-1)!;

    // La scheda rilegge ciò che mostra: testata, CF, recapiti, indirizzo…
    await expect(page.getByRole("heading", { name: `Bianchi ${id} Laura` })).toBeVisible();
    await expect(page.getByText("CF BNCLRA85M50F205Z")).toBeVisible();
    await expect(page.getByText("+39 333 1234567")).toBeVisible();
    await expect(page.getByText(`laura.${id}@esempio.it`)).toBeVisible();
    await expect(page.getByText(/Via Roma 12, Scala B, interno 4/)).toBeVisible();
    // …e le due righe nuove del blocco §4 (assicurazione + fattura a azienda).
    await expect(page.getByText(/^Assicurazione: NESSUNA$/)).toBeVisible();
    await expect(page.getByText(/^Fattura a/)).toContainText("Bianchi SRL");
    await expect(page.getByText(/^Fattura a/)).toContainText("12345678901");
    await expect(page.getByText(/^Fattura a/)).toContainText("SDI ABCDEFG");

    // Round-trip dei campi che la scheda NON stampa (secondo nome, scala,
    // blocco P.IVA): si rileggono dal form di modifica, che è dove tornerebbe
    // il negozio. È la prova che il jsonb `dati_fatturazione` è tornato indietro.
    await page.goto(`/clienti/${clienteId}/modifica`);
    await expect(page.getByLabel("Secondo nome")).toHaveValue("Maria");
    await expect(page.getByLabel("Scala / appartamento")).toHaveValue("Scala B, interno 4");
    await expect(page.getByLabel("Ragione sociale")).toHaveValue("Bianchi SRL");
    await expect(page.getByLabel("CF / P.IVA azienda")).toHaveValue("12345678901");
    await expect(page.getByLabel("Codice SDI")).toHaveValue("ABCDEFG");
  });

  /* ── S2 ─────────────────────────────────────────────────────────────────
   * «consenso a penna (email+cellulare) poi seconda firma digitale con canali
   * diversi: il mastro mostra due righe, la cache l'ultima» (contratto C3).
   * ------------------------------------------------------------------- */
  test("S2 · due firme: il mastro mostra due righe, la cache l'ultima", async ({ page }) => {
    await registraTenant(page);
    await creaCliente(page, { nome: "Laura", cognome: `Consensi ${unico()}` });

    // Prima di tutto: mai chiesto ≠ detto di no. La cache lo dice.
    await expect(rigaMarketing(page)).toHaveText(/^Marketing:\s*non raccolto$/);
    await expect(righeMastroMarketing(page)).toHaveCount(0);

    // Prima firma: a PENNA, canali email + cellulare.
    await page.getByRole("button", { name: "Registra consenso" }).click();
    await page.getByRole("checkbox", { name: "Email", exact: true }).check();
    await page.getByRole("checkbox", { name: "Cellulare", exact: true }).check();
    await page.getByLabel("Modalità").selectOption("penna");
    await page.getByRole("button", { name: "Salva consenso" }).click();

    // La cache (lo stato corrente) dice sì, con quei due canali e in quell'ordine.
    await expect(rigaMarketing(page)).toHaveText(/^Marketing:\s*sì\s*·\s*email, cellulare$/);
    await expect(righeMastroMarketing(page)).toHaveCount(1);

    // Seconda firma: DIGITALE, canali diversi (solo cartaceo).
    await page.getByRole("button", { name: "Registra consenso" }).click();
    await page.getByRole("checkbox", { name: "Cartaceo", exact: true }).check();
    await page.getByLabel("Modalità").selectOption("digitale");
    await page.getByRole("button", { name: "Salva consenso" }).click();

    // Il MASTRO conserva entrambe le firme: due righe, due fatti, due modalità.
    const mastro = righeMastroMarketing(page);
    await expect(mastro).toHaveCount(2);
    await expect(mastro.filter({ hasText: /penna/ })).toHaveCount(1);
    await expect(mastro.filter({ hasText: /digitale/ })).toHaveCount(1);
    await expect(mastro.filter({ hasText: /email, cellulare/ })).toHaveCount(1);
    await expect(mastro.filter({ hasText: /cartaceo/ })).toHaveCount(1);

    // …e la CACHE è l'ULTIMA, non l'unione: è il cuore di C3.
    await expect(rigaMarketing(page)).toHaveText(/^Marketing:\s*sì\s*·\s*cartaceo$/);
    await expect(rigaMarketing(page)).not.toContainText("email");
    await expect(rigaMarketing(page)).not.toContainText("cellulare");
  });

  /* ── S3 ─────────────────────────────────────────────────────────────────
   * «revoca dal tasto: i commerciali si fermano SUBITO, "occhiali pronti"
   * ancora lecito» (f1e.1 + C3).
   *
   * Perché due preparativi e non uno: la frase della spec mette a confronto due
   * richiami, uno COMMERCIALE e uno OPERATIVO, e senza entrambi lo scenario non
   * dimostra niente. Si costruiscono tutti e due dalla UI, senza retrodatare
   * nulla col service role:
   *   • commerciale → una Rx che scade OGGI (data visita 12 mesi fa, validità
   *     12 mesi) fa nascere «Controllo vista in scadenza»;
   *   • operativo   → una busta portata a «pronta» e mai avvisata fa nascere
   *     «Sollecito ritiro», che il GDPR non tocca.
   * ------------------------------------------------------------------- */
  test("S3 · revoca: i richiami commerciali si fermano, gli operativi restano", async ({ page }) => {
    test.slow(); // registrazione + wizard busta + Rx + due passaggi su /richiami
    await registraTenant(page);
    const id = unico();
    const clienteId = await creaCliente(page, {
      nome: "Marco",
      cognome: `Revoca ${id}`,
      telefono: "+39 333 5554444",
    });

    // (1) il fatto OPERATIVO: una busta pronta, non ancora avvisata.
    await page.goto(`/ordini/buste/nuova?cliente=${clienteId}`);
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Crea busta" }).click();
    await page.waitForURL(/\/ordini\/buste\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Segna arrivata" }).click();
    await page.getByRole("button", { name: "Ispeziona e segna pronta" }).click();
    // Il passaggio è avvenuto quando il tasto dell'ispezione non ha più senso:
    // asserzione univoca, mentre un `getByText("Pronta")` pescherebbe insieme
    // la pill di stato e il testo del tasto (strict mode).
    await expect(page.getByRole("button", { name: "Ispeziona e segna pronta" })).toHaveCount(0);

    // (2) il fatto COMMERCIALE: una prescrizione che scade oggi.
    const dodiciMesiFa = new Date();
    dodiciMesiFa.setMonth(dodiciMesiFa.getMonth() - 12);
    await page.goto(`/clienti/${clienteId}/prescrizioni/nuova`);
    await page
      .getByRole("checkbox", { name: /acconsente al trattamento dei dati sanitari/i })
      .check();
    await page.getByLabel("Data visita").fill(dodiciMesiFa.toISOString().slice(0, 10));
    await page.getByLabel("Validità (mesi)").fill("12");
    await page.getByRole("button", { name: "Salva prescrizione" }).click();
    await page.waitForURL(new RegExp(`/clienti/${clienteId}$`));

    // (3) il consenso si dà dal MASTRO (C3): il form cliente non lo spunta più.
    await dammiConsensoMarketing(page, { canali: ["Email"], modalita: "penna" });

    // (4) col consenso, il negozio vede entrambe le proposte.
    await page.goto("/richiami");
    await expect(page.getByText("Controllo vista in scadenza").first()).toBeVisible();
    await expect(page.getByText("Sollecito ritiro").first()).toBeVisible();

    // (5) la revoca, dal tasto, con la sua conferma.
    await page.goto(`/clienti/${clienteId}`);
    await revocaConsensoMarketing(page);
    // Lo stato corrente è spento, ma il FATTO resta nel mastro: due righe, una
    // «dato» e una «revocato». La cache dimentica, il mastro no.
    const mastro = righeMastroMarketing(page);
    await expect(mastro).toHaveCount(2);
    await expect(mastro.filter({ hasText: /revocato/ })).toHaveCount(1);
    await expect(mastro.filter({ hasText: /dato il/ })).toHaveCount(1);

    // (6) SUBITO: il commerciale sparisce (e viene contato), l'operativo resta.
    await page.goto("/richiami");
    await expect(page.getByText("Controllo vista in scadenza")).toHaveCount(0);
    await expect(page.getByText(/proposte commerciali nascoste/i)).toBeVisible();
    await expect(page.getByText("Sollecito ritiro").first()).toBeVisible();
  });

  /* ── S4 ─────────────────────────────────────────────────────────────────
   * «minore con centro sociale come tutore: la relazione c'è, la scheda del
   * minore mostra il referente» (f1d + C4). [MF: fattura al referente → fuori]
   * La riga a DB è UNA: dal lato dell'ente si legge l'etichetta INVERSA,
   * derivata a video — mai materializzata.
   * ------------------------------------------------------------------- */
  test("S4 · minore e tutore-ENTE: una riga, letta dai due lati", async ({ page }) => {
    await registraTenant(page);
    const id = unico();
    // Il tutore È un'anagrafica cliente completa (persona O ENTE).
    await creaCliente(page, { nome: "Centro", cognome: `Sociale ${id}` });
    await creaCliente(page, { nome: "Luca", cognome: `Minore ${id}` });
    // (creaCliente lascia la pagina sulla scheda del MINORE, l'ultimo creato)

    await page.getByRole("button", { name: "Aggiungi relazione" }).click();
    await page.getByLabel("Persona collegata").fill(`Sociale ${id}`);
    await page.getByRole("option", { name: new RegExp(`Centro Sociale ${id}`) }).click();
    await page.getByLabel("Tipo di relazione").selectOption("tutore_legale");
    await page.getByRole("button", { name: "Collega" }).click();

    // La scheda del MINORE mostra il referente, col verso dritto…
    const versoDritto = page.getByRole("link", { name: new RegExp(`Centro Sociale ${id}`) });
    await expect(versoDritto).toBeVisible();
    await expect(versoDritto).toContainText("tutore legale");

    // …e la scheda dell'ENTE mostra il tutelato: stessa riga, letta dall'altro
    // verso (C4: le inverse non si materializzano MAI, si derivano a video).
    await versoDritto.click();
    await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
    const versoInverso = page.getByRole("link", { name: new RegExp(`Luca Minore ${id}`) });
    await expect(versoInverso).toBeVisible();
    await expect(versoInverso).toContainText("tutelato");
  });

  /* ── S5 · prima metà (VIVA) ──────────────────────────────────────────────
   * Il requisito-sconto di M1 §2 ha tre stati, non due, e la distinzione è
   * tutta qui: **null = da rilevare** (non gliel'abbiamo ancora chiesto) ·
   * **NESSUNA = chiesto, non ne ha** · altra voce = quella. Questa metà
   * collauda che i tre stati si impostino e si rileggano dalla scheda; la
   * seconda metà (il cancello sconti in cassa) è sotto, ed è `fixme`.
   * ------------------------------------------------------------------- */
  test("S5 (1/2) · assicurazione: «da rilevare» e «NESSUNA» sono due stati diversi", async ({ page }) => {
    await registraTenant(page);
    const id = unico();
    const clienteId = await creaCliente(page, { nome: "Anna", cognome: `Sconto ${id}` });

    // (a) appena nato: assicurazione NON rilevata → la scheda non dichiara nulla.
    await expect(page.getByText(/^Assicurazione:/)).toHaveCount(0);

    // (b) glielo chiediamo e non ne ha: la voce NESSUNA è un FATTO, e si vede.
    await page.goto(`/clienti/${clienteId}/modifica`);
    await page.getByLabel("Assicurazione").selectOption({ label: "NESSUNA" });
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await page.waitForURL(new RegExp(`/clienti/${clienteId}$`));
    await expect(page.getByText(/^Assicurazione: NESSUNA$/)).toBeVisible();

    // (c) e si torna indietro: la voce vuota rimette il cliente in «da rilevare»
    // (null), che NON è «non ne ha». Le due cose non si confondono mai.
    await page.goto(`/clienti/${clienteId}/modifica`);
    await page.getByLabel("Assicurazione").selectOption({ value: "" });
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await page.waitForURL(new RegExp(`/clienti/${clienteId}$`));
    await expect(page.getByText(/^Assicurazione: NESSUNA$/)).toHaveCount(0);
  });

  /* ── S5 · seconda metà (ANCORA `fixme`) ─────────────────────────────────
   * «assicurazione da-rilevare → in vendita lo sconto assicurativo rifiuta e
   * invita a rilevare; con NESSUNA rifiuta e basta» (AR-01, cancello sconti).
   *
   * BLOCCO RESIDUO — uno solo, e non è più l'anagrafica: il **cancello sconti
   * in cassa non esiste**. In `/cassa/vendita/nuova` non c'è nessuna azione
   * «Sconto assicurativo» e nessun messaggio che distingua «da rilevare» da
   * «non ne ha»: è roba di **M8**, non ancora scritta. Il pezzo di scenario
   * collaudabile oggi (impostare e rileggere l'assicurazione) è stato staccato
   * ed è vivo qui sopra. I nomi qui sotto restano la lettura della SPEC, non un
   * contratto con la UI: si allineano quando M8 arriva.
   * ------------------------------------------------------------------- */
  test.fixme(
    "S5 (2/2) · cancello sconti in cassa: da-rilevare invita, NESSUNA rifiuta — lo sconto assicurativo è M8, non esiste ancora",
    async ({ page }) => {
      await registraTenant(page);
      const id = unico();
      const clienteId = await creaCliente(page, { nome: "Anna", cognome: `Sconto ${id}` });

      // (a) assicurazione DA RILEVARE (null): lo sconto rifiuta e INVITA a rilevare.
      await page.goto("/cassa/vendita/nuova");
      await page.getByLabel("Cliente").fill(`Sconto ${id}`);
      await page.getByRole("option", { name: new RegExp(`Sconto ${id}`) }).click();
      await page.getByRole("button", { name: "Sconto assicurativo" }).click();
      await expect(page.getByText(/assicurazione.*da rilevare/i)).toBeVisible();

      // (b) con la voce NESSUNA: rifiuta e basta, senza invito.
      await page.goto(`/clienti/${clienteId}/modifica`);
      await page.getByLabel("Assicurazione").selectOption({ label: "NESSUNA" });
      await page.getByRole("button", { name: "Salva modifiche" }).click();

      await page.goto("/cassa/vendita/nuova");
      await page.getByLabel("Cliente").fill(`Sconto ${id}`);
      await page.getByRole("option", { name: new RegExp(`Sconto ${id}`) }).click();
      await page.getByRole("button", { name: "Sconto assicurativo" }).click();
      await expect(page.getByText(/non ha un'assicurazione/i)).toBeVisible();
      await expect(page.getByText(/da rilevare/i)).toHaveCount(0);
    }
  );

  /* ── S6 ─────────────────────────────────────────────────────────────────
   * «eliminazione definitiva protetta → anonimizzato, fatti fiscali intatti»
   * (f1e.2 + contratto C1). La query di controllo campo-per-campo vive nel L2
   * (`tests/contratto/b1-anonimizzazione.test.ts`): qui si collauda il GESTO —
   * il tasto protetto, la conferma battuta a mano, e il fatto che la busta
   * resti leggibile DALLA UI con numero e importi.
   * ------------------------------------------------------------------- */
  test("S6 · eliminazione definitiva protetta: anonimo, fatti fiscali intatti", async ({ page }) => {
    test.slow(); // registrazione + wizard busta + anonimizzazione + riletture
    await registraTenant(page);
    const id = unico();
    const clienteId = await creaCliente(page, {
      nome: "Giulia",
      cognome: `DaAnonimizzare ${id}`,
      telefono: "+39 333 9998877",
    });

    // Un FATTO da preservare: una busta con importi (665 + 300 = 965, acconto 780).
    await page.goto(`/ordini/buste/nuova?cliente=${clienteId}`);
    await page.getByLabel("Prezzo montatura (€)").fill("665");
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByLabel("Prezzo lenti (€)").fill("300");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByLabel("Acconto (€)").fill("780");
    await page.getByRole("button", { name: "Crea busta" }).click();
    await page.waitForURL(/\/ordini\/buste\/[0-9a-f-]{36}$/);
    const urlBusta = page.url();
    const numeroBusta = (await page.getByText(/^BL-\d{4}-\d{4}$/).textContent())!.trim();

    // Il gesto protetto: tasto separato + conferma battuta a mano (f1e.2).
    await page.goto(`/clienti/${clienteId}`);
    await page.getByRole("button", { name: "Eliminazione definitiva" }).click();
    await page.getByLabel("Scrivi ELIMINA per confermare").fill("ELIMINA");
    await page.getByRole("button", { name: "Anonimizza definitivamente" }).click();

    // La persona è sparita dalla scheda…
    await expect(page.getByText(/^Anonimizzato-/)).toBeVisible();
    await expect(page.getByText(`DaAnonimizzare ${id}`)).toHaveCount(0);
    await expect(page.getByText("+39 333 9998877")).toHaveCount(0);
    // …e non si trova più cercandola per nome.
    await page.goto("/clienti");
    await page.getByRole("searchbox").fill(`DaAnonimizzare ${id}`);
    await page.getByRole("searchbox").press("Enter");
    await page.waitForURL(/\/clienti\?q=/);
    await expect(page.getByText(`DaAnonimizzare ${id}`)).toHaveCount(0);

    // …ma il FATTO è intatto: numero e importi della busta si leggono ancora.
    await page.goto(urlBusta);
    await expect(page.getByText(numeroBusta, { exact: true })).toBeVisible();
    await expect(page.getByText(/^965,00/)).toBeVisible(); // totale
    await expect(page.getByText(/^780,00/)).toBeVisible(); // acconto
  });
});
