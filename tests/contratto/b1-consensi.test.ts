import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, pulisci, haEnv, RUN_ID, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — **C3 · il libro mastro dei consensi** (migrazione 021).
 *
 * Due metà, entrambe indispensabili:
 *  1. **i CHECK a DB**: gli inserimenti che DEVONO fallire. Si esercitano con
 *     INSERT DIRETTE sulla tabella `consensi`, non attraverso `registra_consenso`:
 *     il contratto dice «vincoli a DB», e un vincolo si collauda provando a
 *     violarlo dalla porta più diretta che l'app abbia (la RLS `for all to
 *     authenticated` permette l'insert: è il CHECK che deve fermarla);
 *  2. **la gara**: due `registra_consenso` marketing concorrenti sullo stesso
 *     cliente. Il lock (`select … for update` dentro la funzione) li mette in
 *     fila; la cache su `clienti` deve riflettere **un solo evento intero**, mai
 *     un misto (marketing di uno e canali dell'altro).
 *
 * Perché la gara NON confronta i timestamp: `avvenuto_il` vale `now()`, cioè
 * l'inizio della TRANSAZIONE — la seconda transazione può essere iniziata prima
 * e aver commesso dopo. Il contratto lo dice esplicitamente: «niente confronti
 * di timestamp, niente pareggi possibili». Quello che si verifica è la
 * COERENZA INTERNA della cache (è la proiezione di UN evento, per intero) e il
 * fatto che nessuna delle due chiamate abbia dato errore.
 *
 * Teardown best-effort: `pulisci()` cancella le aziende create qui e i consensi
 * se ne vanno in cascata (`consensi.azienda_id … on delete cascade`).
 */
describe.skipIf(!haEnv())("021 · C3 · consensi (mastro, CHECK, gara)", () => {
  let A: Tenant;
  let cliente: string;
  let rx: string;

  /** Riga base di un evento del mastro; i test la piegano caso per caso. */
  const evento = (over: Record<string, unknown> = {}) => ({
    azienda_id: A.aziendaId,
    cliente_id: cliente,
    tipo: "marketing",
    azione: "dato",
    canali: ["email"],
    modalita: "penna",
    ...over,
  });

  beforeAll(async () => {
    A = await creaTenant("c3");
    cliente = await creaCliente(A, { nome: "Consenso", cognome: `Mastro ${RUN_ID}` });
    const { data, error } = await A.cli
      .from("prescrizioni")
      .insert({ azienda_id: A.aziendaId, cliente_id: cliente, tipo: "occhiali" })
      .select("id")
      .single();
    if (error) throw new Error(`prescrizione di appoggio: ${error.message}`);
    rx = data!.id as string;
  });
  afterAll(pulisci);

  /* ══ 1 · Gli inserimenti che DEVONO fallire ══════════════════════════════ */

  it("C3(1) · `dati_sanitari` SENZA prescrizione_id → rifiutato", async () => {
    const { error } = await A.cli.from("consensi").insert(
      evento({ tipo: "dati_sanitari", canali: null, prescrizione_id: null })
    );
    expect(error, "il sanitario è PER PRESCRIZIONE: senza Rx non deve entrare").not.toBeNull();
    expect(error!.code, "violazione di CHECK").toBe("23514");
  });

  it("C3(1b) · `dati_sanitari` CON canali → rifiutato (il sanitario non ha canali)", async () => {
    const { error } = await A.cli.from("consensi").insert(
      evento({ tipo: "dati_sanitari", prescrizione_id: rx, canali: ["email"] })
    );
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("C3(2) · `marketing` CON prescrizione_id → rifiutato (il marketing non punta a una Rx)", async () => {
    const { error } = await A.cli.from("consensi").insert(evento({ prescrizione_id: rx }));
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("C3(3) · marketing `dato` con un canale ILLECITO → rifiutato (⊆ {email,cellulare,cartaceo})", async () => {
    for (const illecito of [["piccione"], ["email", "piccione"], ["EMAIL"], ["telefono"]]) {
      const { error } = await A.cli.from("consensi").insert(evento({ canali: illecito }));
      expect(error, `canali ${JSON.stringify(illecito)} non devono passare`).not.toBeNull();
      expect(error!.code).toBe("23514");
    }
  });

  it("C3(3b) · marketing `dato` SENZA modalita → rifiutato (la firma ha sempre una forma)", async () => {
    const { error } = await A.cli.from("consensi").insert(evento({ modalita: null }));
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("C3(3c) · marketing `dato` con canali NULL → rifiutato", async () => {
    const { error } = await A.cli.from("consensi").insert(evento({ canali: null }));
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("C3(3d) · marketing `dato` con canali VUOTI → deve essere rifiutato («non vuoto», C3)", async () => {
    // ⚠️ PUNTO SORVEGLIATO (vedi report-test.md · B1): il CHECK
    // `consensi_dato_marketing_canali` verifica `array_length(canali,1) >= 1`,
    // ma su un array VUOTO `array_length` vale NULL — e un CHECK che valuta NULL
    // **passa**. Se questo test è rosso, il buco è nella 021 (serve
    // `cardinality(canali) >= 1`, oppure `coalesce(array_length(canali,1),0) >= 1`),
    // non nel test: un consenso marketing «dato» senza nessun canale è
    // esattamente ciò che C3 vieta, e la cache lo propagherebbe su `clienti`.
    const { error } = await A.cli.from("consensi").insert(evento({ canali: [] }));
    expect(
      error,
      "marketing 'dato' con canali vuoti è entrato: C3 pretende «canali non vuoto»"
    ).not.toBeNull();
  });

  it("C3(4) · `revocato` CON canali → rifiutato (la revoca è totale per tipo)", async () => {
    const { error } = await A.cli.from("consensi").insert(
      evento({ azione: "revocato", canali: ["email"], modalita: null })
    );
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("vocabolari chiusi: `tipo`, `azione` e `modalita` rifiutano l'invenzione", async () => {
    const ko1 = await A.cli.from("consensi").insert(evento({ tipo: "newsletter" }));
    expect(ko1.error, "tipo inventato").not.toBeNull();
    const ko2 = await A.cli.from("consensi").insert(evento({ azione: "sospeso" }));
    expect(ko2.error, "azione inventata").not.toBeNull();
    const ko3 = await A.cli.from("consensi").insert(evento({ modalita: "sms" }));
    expect(ko3.error, "modalita inventata").not.toBeNull();
  });

  /* ══ 2 · Gli inserimenti LECITI (la prova che i CHECK non sono un muro) ══ */

  it("LECITO · marketing `dato` con DUE canali e modalita passa", async () => {
    const { data, error } = await A.cli
      .from("consensi")
      .insert(evento({ canali: ["email", "cellulare"], modalita: "penna", versione_informativa: "v2" }))
      .select("id, canali, modalita")
      .single();
    expect(error).toBeNull();
    expect(data!.canali).toEqual(["email", "cellulare"]);
  });

  it("LECITO · revoca SENZA modalita passa (il tasto è un gesto operativo)", async () => {
    const { error } = await A.cli
      .from("consensi")
      .insert(evento({ azione: "revocato", canali: null, modalita: null }));
    expect(error, "la modalità è facoltativa sulla revoca").toBeNull();
  });

  it("LECITO · sanitario con Rx e senza canali passa", async () => {
    const { error } = await A.cli
      .from("consensi")
      .insert(evento({ tipo: "dati_sanitari", prescrizione_id: rx, canali: null, modalita: "penna" }));
    expect(error).toBeNull();
  });

  it("LECITO · tutti e tre i canali insieme, in qualunque ordine", async () => {
    const { error } = await A.cli
      .from("consensi")
      .insert(evento({ canali: ["cartaceo", "cellulare", "email"] }));
    expect(error).toBeNull();
  });

  /* ══ 3 · L'azione del mastro: evento + cache nella stessa transazione ════ */

  it("`registra_consenso` scrive l'evento E riallinea la cache marketing", async () => {
    const c = await creaCliente(A, { nome: "Cache", cognome: `Uno ${RUN_ID}` });
    const { data: idEvento, error } = await A.cli.rpc("registra_consenso", {
      p_cliente_id: c,
      p_tipo: "marketing",
      p_azione: "dato",
      p_canali: ["email", "cartaceo"],
      p_modalita: "penna",
      p_prescrizione_id: null,
      p_versione: "v1",
      p_documento_ref: null,
    });
    expect(error).toBeNull();
    expect(idEvento).toBeTruthy();

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali, data_consenso")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing).toBe(true);
    expect(cli!.consenso_canali).toEqual(["email", "cartaceo"]);
    expect(cli!.data_consenso, "il «dal quando» si timbra col consenso").not.toBeNull();
  });

  it("due `dato` consecutivi sono LECITI: due righe nel mastro, la cache è l'ultima", async () => {
    const c = await creaCliente(A, { nome: "Cache", cognome: `Due ${RUN_ID}` });
    const chiama = (canali: string[], modalita: string) =>
      A.cli.rpc("registra_consenso", {
        p_cliente_id: c,
        p_tipo: "marketing",
        p_azione: "dato",
        p_canali: canali,
        p_modalita: modalita,
        p_prescrizione_id: null,
        p_versione: null,
        p_documento_ref: null,
      });

    expect((await chiama(["email", "cellulare"], "penna")).error).toBeNull();
    expect((await chiama(["cartaceo"], "digitale")).error).toBeNull();

    const { data: righe } = await A.cli
      .from("consensi")
      .select("id, canali, modalita")
      .eq("cliente_id", c)
      .eq("tipo", "marketing");
    expect(righe!.length, "il mastro conserva ENTRAMBE le firme").toBe(2);

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing).toBe(true);
    expect(cli!.consenso_canali, "la cache è l'ULTIMO evento, non l'unione").toEqual(["cartaceo"]);
  });

  it("`revoca_marketing` spegne la cache e lascia l'evento nel mastro", async () => {
    const c = await creaCliente(A, { nome: "Cache", cognome: `Tre ${RUN_ID}` });
    await A.cli.rpc("registra_consenso", {
      p_cliente_id: c,
      p_tipo: "marketing",
      p_azione: "dato",
      p_canali: ["email"],
      p_modalita: "penna",
      p_prescrizione_id: null,
      p_versione: null,
      p_documento_ref: null,
    });
    const { error } = await A.cli.rpc("revoca_marketing", { p_cliente_id: c, p_modalita: null });
    expect(error).toBeNull();

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing, "revocato: la cache si spegne").toBe(false);
    expect(cli!.consenso_canali, "revocato: nessun canale resta acceso").toBeNull();

    const { data: righe } = await A.cli.from("consensi").select("azione").eq("cliente_id", c);
    expect(righe!.length, "i FATTI restano: dato + revocato").toBe(2);
    expect(righe!.map((r) => r.azione).sort()).toEqual(["dato", "revocato"]);
  });

  it("il consenso SANITARIO non tocca la cache marketing (per i sanitari nessuna cache)", async () => {
    const c = await creaCliente(A, { nome: "Cache", cognome: `Quattro ${RUN_ID}` });
    const { data: p } = await A.cli
      .from("prescrizioni")
      .insert({ azienda_id: A.aziendaId, cliente_id: c, tipo: "lac" })
      .select("id")
      .single();

    const { error } = await A.cli.rpc("registra_consenso", {
      p_cliente_id: c,
      p_tipo: "dati_sanitari",
      p_azione: "dato",
      p_canali: null,
      p_modalita: "penna",
      p_prescrizione_id: p!.id,
      p_versione: null,
      p_documento_ref: null,
    });
    expect(error).toBeNull();

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing, "il sanitario NON accende il marketing").toBe(false);
    expect(cli!.consenso_canali).toBeNull();

    // …e il sanitario si legge dal MASTRO, per prescrizione.
    const { data: dalMastro } = await A.cli
      .from("consensi")
      .select("id")
      .eq("prescrizione_id", p!.id)
      .eq("tipo", "dati_sanitari");
    expect(dalMastro!.length).toBe(1);
  });

  it("`registra_consenso` su un cliente inesistente → CLIENTE_NON_TROVATO", async () => {
    const { error } = await A.cli.rpc("registra_consenso", {
      p_cliente_id: "00000000-0000-0000-0000-000000000000",
      p_tipo: "marketing",
      p_azione: "dato",
      p_canali: ["email"],
      p_modalita: "penna",
      p_prescrizione_id: null,
      p_versione: null,
      p_documento_ref: null,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/CLIENTE_NON_TROVATO/);
  });

  /* ══ 4 · LA GARA ════════════════════════════════════════════════════════ */

  it("GARA · due `registra_consenso` marketing concorrenti: nessun errore, cache = UN evento intero", async () => {
    const c = await creaCliente(A, { nome: "Gara", cognome: `Due ${RUN_ID}` });
    const chiama = (canali: string[], versione: string) =>
      A.cli.rpc("registra_consenso", {
        p_cliente_id: c,
        p_tipo: "marketing",
        p_azione: "dato",
        p_canali: canali,
        p_modalita: "penna",
        p_prescrizione_id: null,
        p_versione: versione,
        p_documento_ref: null,
      });

    // Insiemi di canali DISGIUNTI: un «misto» (email + cartaceo) sarebbe visibile
    // a occhio nudo e non può nascere da nessuno dei due eventi.
    const [r1, r2] = await Promise.all([
      chiama(["email", "cellulare"], "gara-A"),
      chiama(["cartaceo"], "gara-B"),
    ]);
    expect(r1.error, "la prima chiamata non deve fallire").toBeNull();
    expect(r2.error, "la seconda nemmeno: il lock mette in FILA, non rifiuta").toBeNull();

    // Il mastro ha due righe: nessun evento si è perso.
    const { data: righe } = await A.cli
      .from("consensi")
      .select("id, canali, versione_informativa")
      .eq("cliente_id", c)
      .eq("tipo", "marketing");
    expect(righe!.length, "due firme = due fatti").toBe(2);

    // La cache è la proiezione di UNO dei due eventi, per intero.
    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing).toBe(true);
    const canaliCache = (cli!.consenso_canali as string[] | null) ?? [];
    const candidati = righe!.map((r) => JSON.stringify(r.canali));
    expect(
      candidati,
      `cache MISTA: ${JSON.stringify(canaliCache)} non corrisponde a nessun evento del mastro`
    ).toContain(JSON.stringify(canaliCache));
  });

  it("GARA · `dato` e `revocato` insieme: la cache resta COERENTE (mai acceso senza canali, mai spento con canali)", async () => {
    const c = await creaCliente(A, { nome: "Gara", cognome: `Mista ${RUN_ID}` });
    const [rDato, rRevoca] = await Promise.all([
      A.cli.rpc("registra_consenso", {
        p_cliente_id: c,
        p_tipo: "marketing",
        p_azione: "dato",
        p_canali: ["email", "cellulare"],
        p_modalita: "penna",
        p_prescrizione_id: null,
        p_versione: null,
        p_documento_ref: null,
      }),
      A.cli.rpc("revoca_marketing", { p_cliente_id: c, p_modalita: null }),
    ]);
    expect(rDato.error).toBeNull();
    expect(rRevoca.error).toBeNull();

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();

    // Questa è l'asserzione anti-misto: i due campi vengono dallo STESSO evento.
    if (cli!.consenso_marketing === true) {
      expect(cli!.consenso_canali, "acceso ⇒ i canali sono quelli del `dato`").toEqual([
        "email",
        "cellulare",
      ]);
    } else {
      expect(cli!.consenso_canali, "spento ⇒ nessun canale può restare").toBeNull();
    }

    const { data: righe } = await A.cli.from("consensi").select("azione").eq("cliente_id", c);
    expect(righe!.length, "entrambi i fatti sono nel mastro").toBe(2);
  });

  it("GARA · cinque scritture concorrenti si serializzano: 5 righe, una sola cache coerente", async () => {
    const c = await creaCliente(A, { nome: "Gara", cognome: `Cinque ${RUN_ID}` });
    const set = [["email"], ["cellulare"], ["cartaceo"], ["email", "cartaceo"], ["cellulare", "cartaceo"]];
    const esiti = await Promise.all(
      set.map((canali, i) =>
        A.cli.rpc("registra_consenso", {
          p_cliente_id: c,
          p_tipo: "marketing",
          p_azione: "dato",
          p_canali: canali,
          p_modalita: "penna",
          p_prescrizione_id: null,
          p_versione: `g${i}`,
          p_documento_ref: null,
        })
      )
    );
    for (const [i, e] of esiti.entries()) expect(e.error, `chiamata ${i}`).toBeNull();

    const { data: righe } = await A.cli
      .from("consensi")
      .select("canali")
      .eq("cliente_id", c)
      .eq("tipo", "marketing");
    expect(righe!.length, "nessun evento perso sotto contesa").toBe(5);

    const { data: cli } = await A.cli
      .from("clienti")
      .select("consenso_marketing, consenso_canali")
      .eq("id", c)
      .single();
    expect(cli!.consenso_marketing).toBe(true);
    expect(
      set.map((s) => JSON.stringify(s)),
      "la cache deve essere uno degli insiemi scritti, per intero"
    ).toContain(JSON.stringify(cli!.consenso_canali));
  });

  /* ══ 5 · La cache non si scrive mai a mano — il richiamo del contratto ══ */

  it("la cache è comunque SCRIVIBILE a mano dalla RLS: l'invariante lo tiene il codice (guardia L4)", async () => {
    // Fotografia onesta del contratto: C3 dice «la cache non si scrive MAI
    // direttamente», ma la policy di `clienti` è `for all to authenticated` e a
    // DB non c'è nulla che lo impedisca. La difesa vive nel CODICE (nessun
    // `.update({consenso_marketing})` in lib/) ed è sorvegliata dalla guardia
    // statica G22 in tests/unit/guardie.test.ts. Qui lo si REGISTRA, così se un
    // giorno arrivasse un trigger di blocco questo test diventa il suo promemoria.
    const c = await creaCliente(A, { nome: "Cache", cognome: `Mano ${RUN_ID}` });
    const { error } = await A.cli
      .from("clienti")
      .update({ consenso_marketing: true, consenso_canali: ["email"] })
      .eq("id", c);
    expect(error, "oggi il DB non lo vieta: l'invariante è nel codice, non nello schema").toBeNull();
    const { data: righe } = await A.cli.from("consensi").select("id").eq("cliente_id", c);
    expect(righe!.length, "…e infatti il mastro resta VUOTO: cache senza fatto").toBe(0);
  });
});
