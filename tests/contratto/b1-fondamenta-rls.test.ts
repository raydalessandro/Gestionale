import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  creaCliente,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — **021 · le fondamenta: isolamento, grant, tenant**.
 *
 * Cinque tabelle nuove entrano nello schema. La domanda che questo file pone a
 * ciascuna è sempre la stessa, ed è la più importante del progetto:
 *   • un ALTRO negozio la vede? (deve essere no, tranne il catalogo globale)
 *   • `anon` ci arriva? (deve essere no: dopo la 020 le tabelle non sono per il
 *     pubblico, e la 021 mette la stessa igiene sulle nuove — più le
 *     `alter default privileges` che la rendono permanente)
 *   • una FK incrociata fra aziende che errore dà? **23514**, mai 23503: è la
 *     regola del patto, il trigger di coerenza tenant deve arrivare PRIMA della
 *     foreign key.
 *
 * Qui vivono anche i due registri minori di B1 (`oculisti` con la sua funzione
 * al volo, `parametri` con l'unicità per negozio) e il catalogo globale
 * `assicurazioni`, che per disegno è leggibile da OGNI autenticato ma non da anon.
 */

/** Le cinque tabelle nate con la 021. */
const NUOVE = [
  "assicurazioni",
  "oculisti",
  "parametri",
  "consensi",
  "clienti_relazioni",
] as const;

describe.skipIf(!haEnv())("021 · fondamenta · RLS, grant e coerenza tenant", () => {
  let A: Tenant;
  let B: Tenant;
  let anon: SupabaseClient;
  let clienteA: string;
  let clienteB: string;

  beforeAll(async () => {
    anon = anonClient();
    [A, B] = await Promise.all([creaTenant("f21a"), creaTenant("f21b")]);
    [clienteA, clienteB] = await Promise.all([
      creaCliente(A, { nome: "Cli", cognome: `A ${RUN_ID}` }),
      creaCliente(B, { nome: "Cli", cognome: `B ${RUN_ID}` }),
    ]);
  });
  afterAll(pulisci);

  /* ══ 1 · anon non arriva a nessuna delle cinque ═════════════════════════ */

  it("anon NON legge nessuna delle 5 tabelle nuove (nemmeno il catalogo assicurazioni)", async () => {
    for (const tab of NUOVE) {
      const r = await anon.from(tab).select("*").limit(1);
      expect(r.error, `anon non deve poter interrogare ${tab}`).toBeTruthy();
      expect((r.data ?? []).length, `anon non deve ottenere righe da ${tab}`).toBe(0);
    }
  });

  it("anon NON scrive su nessuna delle 5 tabelle nuove", async () => {
    const tentativi: [string, Record<string, unknown>][] = [
      ["assicurazioni", { nome: `Intrusa ${RUN_ID}` }],
      ["oculisti", { azienda_id: A.aziendaId, nome: `Dott. Intruso ${RUN_ID}` }],
      ["parametri", { azienda_id: A.aziendaId, chiave: `x-${RUN_ID}`, valore: { a: 1 } }],
      [
        "consensi",
        {
          azienda_id: A.aziendaId,
          cliente_id: clienteA,
          tipo: "marketing",
          azione: "dato",
          canali: ["email"],
          modalita: "penna",
        },
      ],
      [
        "clienti_relazioni",
        { azienda_id: A.aziendaId, cliente_id: clienteA, relativo_id: clienteB, tipo: "fratello" },
      ],
    ];
    for (const [tab, riga] of tentativi) {
      const r = await anon.from(tab).insert(riga);
      expect(r.error, `anon non deve poter scrivere su ${tab}`).toBeTruthy();
    }
  });

  it("le RPC di B1 non sono eseguibili da anon (grant solo ad authenticated)", async () => {
    const rpc: [string, Record<string, unknown>][] = [
      ["registra_consenso", { p_cliente_id: clienteA, p_tipo: "marketing", p_azione: "dato" }],
      ["revoca_marketing", { p_cliente_id: clienteA }],
      [
        "crea_relazione",
        { p_cliente_id: clienteA, p_relativo_id: clienteB, p_tipo: "fratello" },
      ],
      ["crea_oculista_al_volo", { p_nome: `Dott. Anon ${RUN_ID}` }],
      ["anonimizza_cliente", { p_cliente_id: clienteA }],
    ];
    for (const [nome, args] of rpc) {
      const r = await anon.rpc(nome, args);
      expect(r.error, `anon non deve poter eseguire ${nome}`).toBeTruthy();
    }
  });

  /* ══ 2 · isolamento fra negozi ══════════════════════════════════════════ */

  it("RLS · l'azienda A non vede consensi, relazioni, oculisti e parametri di B", async () => {
    // B semina una riga per tabella…
    const semi = await Promise.all([
      B.cli
        .from("consensi")
        .insert({
          azienda_id: B.aziendaId,
          cliente_id: clienteB,
          tipo: "marketing",
          azione: "dato",
          canali: ["email"],
          modalita: "penna",
        })
        .select("id")
        .single(),
      B.cli
        .from("clienti_relazioni")
        .insert({
          azienda_id: B.aziendaId,
          cliente_id: clienteB,
          relativo_id: await creaCliente(B, { nome: "Rel", cognome: `B ${RUN_ID}` }),
          tipo: "sorella",
        })
        .select("id")
        .single(),
      B.cli
        .from("oculisti")
        .insert({ azienda_id: B.aziendaId, nome: `Dott. B ${RUN_ID}` })
        .select("id")
        .single(),
      B.cli
        .from("parametri")
        .insert({ azienda_id: B.aziendaId, chiave: "fondo_cassa", valore: { euro: 150 } })
        .select("id")
        .single(),
    ]);
    for (const s of semi) expect(s.error, "il seed di B deve riuscire").toBeNull();

    // …e A non ne vede nessuna, né per id né con una select larga.
    const tabelle = ["consensi", "clienti_relazioni", "oculisti", "parametri"] as const;
    for (const [i, tab] of tabelle.entries()) {
      const id = semi[i].data!.id as string;
      const { data } = await A.cli.from(tab).select("id").eq("id", id).maybeSingle();
      expect(data, `A non deve vedere la riga di B in ${tab}`).toBeNull();

      const { data: tutte } = await A.cli.from(tab).select("azienda_id");
      const estranee = (tutte ?? []).filter((r) => r.azienda_id !== A.aziendaId);
      expect(estranee, `A vede righe di altri negozi in ${tab}`).toEqual([]);
    }
  });

  it("RLS · A non può SCRIVERE nell'azienda di B (with check nega)", async () => {
    const tentativi: [string, Record<string, unknown>][] = [
      [
        "consensi",
        {
          azienda_id: B.aziendaId,
          cliente_id: clienteB,
          tipo: "marketing",
          azione: "dato",
          canali: ["email"],
          modalita: "penna",
        },
      ],
      ["oculisti", { azienda_id: B.aziendaId, nome: `Dott. Intruso ${RUN_ID}` }],
      ["parametri", { azienda_id: B.aziendaId, chiave: `intruso-${RUN_ID}`, valore: { a: 1 } }],
    ];
    for (const [tab, riga] of tentativi) {
      const { error } = await A.cli.from(tab).insert(riga);
      expect(error, `A non deve poter scrivere in ${tab} di B`).not.toBeNull();
    }
  });

  it("`assicurazioni` è un catalogo GLOBALE: ogni autenticato lo legge, la voce NESSUNA c'è", async () => {
    for (const t of [A, B]) {
      const { data, error } = await t.cli.from("assicurazioni").select("id, nome").eq("nome", "NESSUNA");
      expect(error, "il catalogo è in lettura per tutti gli autenticati").toBeNull();
      expect(data!.length, "la voce «NESSUNA» distingue «chiesto, non ne ha» da «da rilevare»").toBe(1);
    }
  });

  it("`assicurazioni` non si scrive dall'app (nessuna policy di insert)", async () => {
    const { error } = await A.cli.from("assicurazioni").insert({ nome: `Fittizia ${RUN_ID}` });
    expect(error, "il catalogo si popola con le migrazioni, non dal banco").not.toBeNull();
  });

  /* ══ 3 · Coerenza tenant: 23514, MAI 23503 ═════════════════════════════ */

  it("TENANT · consenso di A che punta a un cliente di B → 23514 (mai 23503)", async () => {
    const { error } = await A.cli.from("consensi").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteB, // di un'altra azienda
      tipo: "marketing",
      azione: "dato",
      canali: ["email"],
      modalita: "penna",
    });
    expect(error).not.toBeNull();
    expect(error!.code, "gli errori tenant sono SEMPRE 23514").toBe("23514");
    expect(error!.code, "mai la foreign key nuda").not.toBe("23503");
  });

  it("TENANT · consenso di A che punta a una prescrizione di B → 23514", async () => {
    const { data: rxB } = await B.cli
      .from("prescrizioni")
      .insert({ azienda_id: B.aziendaId, cliente_id: clienteB, tipo: "occhiali" })
      .select("id")
      .single();
    const { error } = await A.cli.from("consensi").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      tipo: "dati_sanitari",
      azione: "dato",
      prescrizione_id: rxB!.id,
      modalita: "penna",
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");
  });

  it("TENANT · `clienti.azienda_convenzionata_id` verso un cliente di B → 23514", async () => {
    // La colonna additiva della 021 è la ragione per cui `clienti` entra ORA nel
    // trigger di coerenza tenant: prima non aveva FK verso tabelle con azienda_id.
    const { error } = await A.cli
      .from("clienti")
      .update({ azienda_convenzionata_id: clienteB })
      .eq("id", clienteA);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514");

    // …mentre l'ente convenzionato della PROPRIA azienda passa.
    const ente = await creaCliente(A, { nome: "Ente", cognome: `Convenzione ${RUN_ID}` });
    const ok = await A.cli
      .from("clienti")
      .update({ azienda_convenzionata_id: ente })
      .eq("id", clienteA);
    expect(ok.error).toBeNull();
  });

  /* ══ 4 · Oculisti (M2 f2b) ═════════════════════════════════════════════ */

  it("`crea_oculista_al_volo` è idempotente su (negozio, nome, studio) normalizzati", async () => {
    const nome = `Dott. Verdi ${RUN_ID}`;
    const p1 = await A.cli.rpc("crea_oculista_al_volo", {
      p_nome: nome,
      p_studio: "Studio Centro",
      p_citta: "Milano",
    });
    expect(p1.error).toBeNull();
    // Stesso oculista, scritto diversamente: si SELEZIONA, non si duplica.
    const p2 = await A.cli.rpc("crea_oculista_al_volo", {
      p_nome: `  ${nome.toUpperCase()}  `,
      p_studio: "studio centro",
      p_citta: null,
    });
    expect(p2.error).toBeNull();
    expect(p2.data, "stesso oculista = stesso id").toBe(p1.data);

    // Stesso nome ma studio diverso: è un altro oculista (omonimi, prassi di settore).
    const p3 = await A.cli.rpc("crea_oculista_al_volo", {
      p_nome: nome,
      p_studio: "Studio Nord",
      p_citta: null,
    });
    expect(p3.error).toBeNull();
    expect(p3.data).not.toBe(p1.data);
  });

  it("`crea_oculista_al_volo` rifiuta il nome vuoto e non sconfina di negozio", async () => {
    const vuoto = await A.cli.rpc("crea_oculista_al_volo", { p_nome: "   ", p_studio: null, p_citta: null });
    expect(vuoto.error).not.toBeNull();
    expect(vuoto.error!.message).toMatch(/NOME_OBBLIGATORIO/);

    // Lo stesso nome in due negozi diversi = due righe distinte, ognuna a casa sua.
    const nome = `Dott. Bicolore ${RUN_ID}`;
    const inA = await A.cli.rpc("crea_oculista_al_volo", { p_nome: nome, p_studio: null, p_citta: null });
    const inB = await B.cli.rpc("crea_oculista_al_volo", { p_nome: nome, p_studio: null, p_citta: null });
    expect(inA.error).toBeNull();
    expect(inB.error).toBeNull();
    expect(inA.data).not.toBe(inB.data);

    const { data: vistoDaA } = await A.cli.from("oculisti").select("id").eq("id", inB.data as string);
    expect(vistoDaA ?? [], "l'oculista di B non esiste per A").toEqual([]);
  });

  it("l'indice unico degli oculisti ferma il doppione anche con insert diretta (23505)", async () => {
    const nome = `Dott. Unico ${RUN_ID}`;
    const ok = await A.cli
      .from("oculisti")
      .insert({ azienda_id: A.aziendaId, nome, studio: "Studio X" });
    expect(ok.error).toBeNull();
    const ko = await A.cli
      .from("oculisti")
      .insert({ azienda_id: A.aziendaId, nome: `  ${nome.toLowerCase()} `, studio: "studio x" });
    expect(ko.error, "normalizzato, è lo stesso oculista").not.toBeNull();
    expect(ko.error!.code).toBe("23505");
  });

  /* ══ 5 · Parametri (M10 §4) ════════════════════════════════════════════ */

  it("`parametri` è unico per (negozio, chiave) e l'upsert aggiorna il valore", async () => {
    const chiave = `tolleranza_versamento_${RUN_ID}`;
    const primo = await A.cli
      .from("parametri")
      .insert({ azienda_id: A.aziendaId, chiave, valore: { euro: 5 } });
    expect(primo.error).toBeNull();

    const doppio = await A.cli
      .from("parametri")
      .insert({ azienda_id: A.aziendaId, chiave, valore: { euro: 10 } });
    expect(doppio.error, "una chiave, un valore per negozio").not.toBeNull();
    expect(doppio.error!.code).toBe("23505");

    // La stessa chiave in un altro negozio è un'altra politica: deve passare.
    const altrove = await B.cli
      .from("parametri")
      .insert({ azienda_id: B.aziendaId, chiave, valore: { euro: 20 } });
    expect(altrove.error).toBeNull();

    // L'upsert (la forma che usa l'azione `scriviParametro`) aggiorna.
    const up = await A.cli
      .from("parametri")
      .upsert(
        { azienda_id: A.aziendaId, chiave, valore: { euro: 7 } },
        { onConflict: "azienda_id,chiave" }
      );
    expect(up.error).toBeNull();
    const { data } = await A.cli
      .from("parametri")
      .select("valore")
      .eq("azienda_id", A.aziendaId)
      .eq("chiave", chiave)
      .single();
    expect(data!.valore).toEqual({ euro: 7 });
  });

  it("`parametri.updated_at` si muove da solo (trigger tocca_updated_at)", async () => {
    const chiave = `passo_slot_${RUN_ID}`;
    const { data: prima } = await A.cli
      .from("parametri")
      .insert({ azienda_id: A.aziendaId, chiave, valore: { minuti: 15 } })
      .select("id, updated_at")
      .single();

    await new Promise((r) => setTimeout(r, 1100));
    const { data: dopo } = await A.cli
      .from("parametri")
      .update({ valore: { minuti: 20 } })
      .eq("id", prima!.id)
      .select("updated_at")
      .single();

    expect(
      new Date(dopo!.updated_at as string).getTime(),
      "l'updated_at deve essere riscritto dal trigger"
    ).toBeGreaterThan(new Date(prima!.updated_at as string).getTime());
  });

  /* ══ 6 · La colonna additiva che governa le letture ════════════════════ */

  it("`clienti.anonimizzato_il` nasce NULL e l'indice parziale esiste per escluderli", async () => {
    const c = await creaCliente(A, { nome: "Vivo", cognome: `Vegeto ${RUN_ID}` });
    const { data } = await A.cli
      .from("clienti")
      .select("anonimizzato_il, consenso_canali, dati_fatturazione, assicurazione_id")
      .eq("id", c)
      .single();
    expect(data!.anonimizzato_il, "un cliente nuovo non è anonimo").toBeNull();
    expect(data!.consenso_canali, "nessun canale finché non c'è una firma").toBeNull();
    expect(data!.dati_fatturazione).toBeNull();
    expect(data!.assicurazione_id, "null = DA RILEVARE (≠ voce NESSUNA)").toBeNull();
  });
});
