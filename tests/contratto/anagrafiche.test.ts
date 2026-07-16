import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, pulisci, haEnv, RUN_ID, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — Migrazione 006 (Fase 4b · Pass anagrafiche).
 * Solo vocabolario delle voci, zero flussi toccati: qui verifichiamo i check
 * additivi e i default NOT NULL introdotti dalla 006.
 *  • clienti: sesso ∈ (M,F) · canale_preferito ∈ lista · non_contattare NOT NULL default false
 *  • prescrizioni: od_dnp/os_dnp ∈ [20,45] (o null)
 *  • prodotti: tipo ora include 'sole' · ricambio_giorni > 0 (o null)
 * L'isolamento RLS sulle stesse tabelle è già coperto da rls-isolamento.test.ts:
 * le colonne nuove viaggiano sulle policy esistenti (nessuna nuova tabella).
 */
describe.skipIf(!haEnv())("006 · Pass anagrafiche", () => {
  let A: Tenant;

  beforeAll(async () => {
    A = await creaTenant("anag");
  });
  afterAll(pulisci);

  /* ── clienti ─────────────────────────────────────────────────────────── */

  it("clienti.sesso accetta M/F e rifiuta qualsiasi altro valore", async () => {
    const ok = await A.cli
      .from("clienti")
      .insert({ azienda_id: A.aziendaId, nome: "Ada", cognome: `Sx ${RUN_ID}`, sesso: "F" })
      .select("id")
      .single();
    expect(ok.error).toBeNull();

    const ko = await A.cli
      .from("clienti")
      .insert({ azienda_id: A.aziendaId, nome: "Ada", cognome: `Sx ${RUN_ID}`, sesso: "X" });
    expect(ko.error).not.toBeNull();
  });

  it("clienti.canale_preferito accetta la lista 006 e rifiuta un canale inventato", async () => {
    for (const canale of ["telefono", "whatsapp", "sms", "email", "cartaceo"]) {
      const { error } = await A.cli
        .from("clienti")
        .insert({ azienda_id: A.aziendaId, nome: "Cx", cognome: `Cx ${RUN_ID}`, canale_preferito: canale });
      expect(error, `canale valido rifiutato: ${canale}`).toBeNull();
    }
    const ko = await A.cli
      .from("clienti")
      .insert({ azienda_id: A.aziendaId, nome: "Cx", cognome: `Cx ${RUN_ID}`, canale_preferito: "piccione" });
    expect(ko.error).not.toBeNull();
  });

  it("clienti.non_contattare è NOT NULL con default false", async () => {
    const id = await creaCliente(A); // non passa non_contattare
    const { data, error } = await A.cli
      .from("clienti")
      .select("non_contattare")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    expect(data!.non_contattare).toBe(false);

    // un tentativo esplicito di NULL viene rifiutato dal NOT NULL
    const ko = await A.cli
      .from("clienti")
      .insert({ azienda_id: A.aziendaId, nome: "Nx", cognome: `Nx ${RUN_ID}`, non_contattare: null });
    expect(ko.error).not.toBeNull();
  });

  /* ── prescrizioni · DNP ──────────────────────────────────────────────── */

  it("prescrizioni.od_dnp/os_dnp accettano 20–45 (e null) e rifiutano fuori intervallo", async () => {
    const cliente = await creaCliente(A);
    const base = { azienda_id: A.aziendaId, cliente_id: cliente, tipo: "occhiali" as const };

    const ok = await A.cli
      .from("prescrizioni")
      .insert({ ...base, od_dnp: 31.5, os_dnp: 45 });
    expect(ok.error).toBeNull();

    const nulli = await A.cli.from("prescrizioni").insert({ ...base, od_dnp: null, os_dnp: null });
    expect(nulli.error).toBeNull();

    const basso = await A.cli.from("prescrizioni").insert({ ...base, od_dnp: 19.5 });
    expect(basso.error).not.toBeNull();

    const alto = await A.cli.from("prescrizioni").insert({ ...base, os_dnp: 46 });
    expect(alto.error).not.toBeNull();
  });

  /* ── prodotti · tipo 'sole' e ricambio_giorni ────────────────────────── */

  it("prodotti.tipo ora include 'sole' e continua a rifiutare i tipi ignoti", async () => {
    const sole = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "sole", nome: `Sole ${RUN_ID}`, prezzo: 120 });
    expect(sole.error).toBeNull();

    const ignoto = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "gadget", nome: `X ${RUN_ID}`, prezzo: 1 });
    expect(ignoto.error).not.toBeNull();
  });

  it("prodotti.ricambio_giorni: >0 accettato, null accettato, 0/negativo rifiutati", async () => {
    const ok = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "lac", nome: `LAC30 ${RUN_ID}`, prezzo: 25, ricambio_giorni: 30 });
    expect(ok.error).toBeNull();

    const nullo = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "lac", nome: `LACn ${RUN_ID}`, prezzo: 25, ricambio_giorni: null });
    expect(nullo.error).toBeNull();

    const zero = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "lac", nome: `LAC0 ${RUN_ID}`, prezzo: 25, ricambio_giorni: 0 });
    expect(zero.error).not.toBeNull();

    const neg = await A.cli
      .from("prodotti")
      .insert({ azienda_id: A.aziendaId, tipo: "lac", nome: `LACm ${RUN_ID}`, prezzo: 25, ricambio_giorni: -7 });
    expect(neg.error).not.toBeNull();
  });
});
