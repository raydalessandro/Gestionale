import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, pulisci, haEnv, RUN_ID, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — **C4 · relazioni fra clienti** (migrazione 021).
 *
 * L'invariante in una riga: **una coppia = AL PIÙ UNA relazione familiare, e la
 * relazione è UNA riga fisica** — le inverse non si materializzano mai (la
 * lettura nei due versi è dell'azione, non del dato).
 *
 * Si collauda su DUE strati, perché il contratto ne prevede due:
 *  • la GUARDIA DI COPPIA dentro `crea_relazione` (errore parlante
 *    `gia_in_relazione` con la riga esistente) — è quella che vede l'utente;
 *  • la BLINDATURA a DB (unique index funzionale su
 *    `least/greatest` limitato ai tipi familiari) — quella che regge anche se
 *    l'azione ha un bug. Si esercita con INSERT DIRETTE, scavalcando la funzione.
 *
 * `tutore_legale` è categoria a parte: può coesistere con una familiare.
 */
describe.skipIf(!haEnv())("021 · C4 · relazioni (una riga, mai le inverse)", () => {
  let A: Tenant;
  let B: Tenant;

  const FAMILIARI = ["padre", "madre", "figlio", "fratello", "sorella"] as const;

  /** Chiama la funzione del contratto come farebbe l'azione. */
  const crea = (t: Tenant, cliente: string, relativo: string, tipo: string) =>
    t.cli.rpc("crea_relazione", {
      p_cliente_id: cliente,
      p_relativo_id: relativo,
      p_tipo: tipo,
      p_note: null,
    });

  /** Insert DIRETTA: scavalca la guardia dell'azione, resta solo il DB. */
  const inserisci = (t: Tenant, cliente: string, relativo: string, tipo: string) =>
    t.cli
      .from("clienti_relazioni")
      .insert({ azienda_id: t.aziendaId, cliente_id: cliente, relativo_id: relativo, tipo });

  let coppia = 0;
  async function duePersone(t: Tenant): Promise<[string, string]> {
    const n = coppia++;
    return Promise.all([
      creaCliente(t, { nome: "Uno", cognome: `Coppia${n} ${RUN_ID}` }),
      creaCliente(t, { nome: "Due", cognome: `Coppia${n} ${RUN_ID}` }),
    ]);
  }

  beforeAll(async () => {
    [A, B] = await Promise.all([creaTenant("c4a"), creaTenant("c4b")]);
  });
  afterAll(pulisci);

  /* ══ 1 · Nessuno è parente di sé stesso ═════════════════════════════════ */

  it("C4 · self via `crea_relazione` → errore `relazione_con_se_stesso`", async () => {
    const [x] = await duePersone(A);
    const { error } = await crea(A, x, x, "fratello");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/relazione_con_se_stesso/);
  });

  it("C4 · self anche a DB (insert diretta) → violazione di CHECK 23514", async () => {
    const [x] = await duePersone(A);
    const { error } = await inserisci(A, x, x, "tutore_legale");
    expect(error, "il check `cliente_id <> relativo_id` deve fermare anche l'insert diretta").not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  /* ══ 2 · La guardia di coppia, nei DUE versi ════════════════════════════ */

  it("C4 · doppia familiare, STESSO verso → `gia_in_relazione`", async () => {
    const [a, b] = await duePersone(A);
    expect((await crea(A, a, b, "padre")).error).toBeNull();
    const { error } = await crea(A, a, b, "madre");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/gia_in_relazione/);
    // L'errore è PARLANTE: nomina il tipo già presente (C4 «mostrando la riga»).
    expect(error!.message).toMatch(/padre/);
  });

  it("C4 · doppia familiare, verso INVERSO → `gia_in_relazione` (la coppia è simmetrica)", async () => {
    const [a, b] = await duePersone(A);
    expect((await crea(A, a, b, "padre")).error).toBeNull();
    const { error } = await crea(A, b, a, "figlio");
    expect(error, "l'inversa NON si scrive: la relazione esiste già").not.toBeNull();
    expect(error!.message).toMatch(/gia_in_relazione/);
  });

  it("C4 · una sola riga a DB dopo il tentativo nei due versi (le inverse non si materializzano)", async () => {
    const [a, b] = await duePersone(A);
    await crea(A, a, b, "fratello");
    await crea(A, b, a, "fratello"); // rifiutata
    await crea(A, b, a, "sorella"); // rifiutata

    const { data, error } = await A.cli
      .from("clienti_relazioni")
      .select("id, cliente_id, relativo_id, tipo")
      .or(`cliente_id.eq.${a},relativo_id.eq.${a}`);
    expect(error).toBeNull();
    expect(data!.length, "UNA riga fisica, non due").toBe(1);
    expect(data![0].tipo).toBe("fratello");
    expect(data![0].cliente_id).toBe(a);
    expect(data![0].relativo_id).toBe(b);
  });

  it("C4 · ogni combinazione di tipi familiari è bloccata dopo la prima (matrice completa)", async () => {
    for (const primo of FAMILIARI) {
      const [a, b] = await duePersone(A);
      expect((await crea(A, a, b, primo)).error, `prima relazione ${primo}`).toBeNull();
      for (const secondo of FAMILIARI) {
        const dritto = await crea(A, a, b, secondo);
        expect(dritto.error, `${primo} poi ${secondo} (stesso verso)`).not.toBeNull();
        const rovescio = await crea(A, b, a, secondo);
        expect(rovescio.error, `${primo} poi ${secondo} (verso inverso)`).not.toBeNull();
      }
    }
  });

  /* ══ 3 · La blindatura a DB (l'azione si scavalca, l'indice no) ═════════ */

  it("C4 · l'indice funzionale least/greatest ferma anche l'insert DIRETTA inversa → 23505", async () => {
    const [a, b] = await duePersone(A);
    expect((await inserisci(A, a, b, "madre")).error).toBeNull();
    const { error } = await inserisci(A, b, a, "figlio");
    expect(
      error,
      "nemmeno un bug dell'azione deve poter creare la doppia familiare"
    ).not.toBeNull();
    expect(error!.code, "unique violation dell'indice uq_relazione_familiare_per_coppia").toBe("23505");
  });

  it("C4 · la stessa relazione identica due volte → 23505 (unique di tabella)", async () => {
    const [a, b] = await duePersone(A);
    expect((await inserisci(A, a, b, "tutore_legale")).error).toBeNull();
    const { error } = await inserisci(A, a, b, "tutore_legale");
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
  });

  /* ══ 4 · Il tutore è categoria a parte ══════════════════════════════════ */

  it("C4 · `tutore_legale` COESISTE con `padre` sulla stessa coppia (due righe, una sola familiare)", async () => {
    const [minore, tutore] = await duePersone(A);
    expect((await crea(A, minore, tutore, "padre")).error, "la familiare").toBeNull();
    expect(
      (await crea(A, minore, tutore, "tutore_legale")).error,
      "la tutela è categoria a parte: deve poter coesistere"
    ).toBeNull();

    const { data } = await A.cli
      .from("clienti_relazioni")
      .select("tipo")
      .or(`cliente_id.eq.${minore},relativo_id.eq.${minore}`);
    expect(data!.map((r) => r.tipo).sort()).toEqual(["padre", "tutore_legale"]);

    const familiari = data!.filter((r) => (FAMILIARI as readonly string[]).includes(r.tipo));
    expect(familiari.length, "UNA sola relazione familiare per coppia").toBe(1);
  });

  it("C4 · il tutore può essere un ENTE (una scheda cliente come le altre) e vale nei due versi", async () => {
    const minore = await creaCliente(A, { nome: "Minore", cognome: `Tutelato ${RUN_ID}` });
    const ente = await creaCliente(A, { nome: "Centro", cognome: `Sociale ${RUN_ID}` });
    expect((await crea(A, minore, ente, "tutore_legale")).error).toBeNull();

    // La lettura «dall'altro lato» è una QUERY, non una seconda riga.
    const { data: dalMinore } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .eq("cliente_id", minore);
    const { data: dallEnte } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .eq("relativo_id", ente);
    expect(dalMinore!.length).toBe(1);
    expect(dallEnte!.length).toBe(1);
    expect(dalMinore![0].id, "è la STESSA riga letta dai due versi").toBe(dallEnte![0].id);
  });

  /* ══ 5 · Vocabolario, clienti inesistenti, tenant ═══════════════════════ */

  it("un tipo di relazione inventato è rifiutato dal check", async () => {
    const [a, b] = await duePersone(A);
    const { error } = await inserisci(A, a, b, "cugino_di_secondo_grado");
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("`crea_relazione` verso un cliente inesistente → CLIENTE_NON_TROVATO", async () => {
    const [a] = await duePersone(A);
    const { error } = await crea(A, a, "00000000-0000-0000-0000-000000000000", "fratello");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/CLIENTE_NON_TROVATO/);
  });

  it("TENANT · una relazione fra clienti di aziende diverse è rifiutata (23514, mai 23503)", async () => {
    const [a] = await duePersone(A);
    const b = await creaCliente(B, { nome: "Altro", cognome: `Negozio ${RUN_ID}` });
    // Insert diretta con l'azienda giusta ma un relativo di un'ALTRA azienda:
    // il trigger di coerenza tenant (DB-01) deve dare 23514.
    const { error } = await inserisci(A, a, b, "fratello");
    expect(error, "FK incrociata fra aziende").not.toBeNull();
    expect(error!.code, "gli errori tenant sono SEMPRE 23514").toBe("23514");
  });

  /* ══ 6 · `elimina_relazione` (l'unica cancellazione fisica ammessa) ═════ */

  it("`elimina_relazione` toglie la riga e libera la coppia per una nuova familiare", async () => {
    const [a, b] = await duePersone(A);
    expect((await crea(A, a, b, "padre")).error).toBeNull();
    const { data: riga } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .eq("cliente_id", a)
      .eq("relativo_id", b)
      .single();

    const { error } = await A.cli.rpc("elimina_relazione", { p_id: riga!.id });
    expect(error, "la relazione è ANAGRAFE, non un fatto: si può togliere").toBeNull();

    const { data: dopo } = await A.cli.from("clienti_relazioni").select("id").eq("id", riga!.id);
    expect(dopo ?? []).toEqual([]);
    // …e ora la coppia può avere di nuovo UNA relazione familiare.
    expect((await crea(A, a, b, "madre")).error).toBeNull();
  });

  it("TENANT · B non può eliminare una relazione di A (la RLS la rende invisibile)", async () => {
    const [a, b] = await duePersone(A);
    await crea(A, a, b, "sorella");
    const { data: riga } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .eq("cliente_id", a)
      .single();

    // Sotto RLS la delete di B non trova righe: nessun errore, nessun effetto.
    const { error } = await B.cli.rpc("elimina_relazione", { p_id: riga!.id });
    expect(error, "per B quella riga non esiste: la delete è un no-op silenzioso").toBeNull();

    const { data: sopravvissuta } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .eq("id", riga!.id);
    expect(sopravvissuta!.length, "la relazione di A deve essere ancora lì").toBe(1);
  });

  it("RLS · l'azienda B non vede le relazioni di A", async () => {
    const [a, b] = await duePersone(A);
    await crea(A, a, b, "sorella");
    const { data } = await B.cli.from("clienti_relazioni").select("id").eq("cliente_id", a);
    expect(data ?? [], "le relazioni di A non esistono, per B").toEqual([]);
  });
});
