import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, creaProdotto, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — Migrazione 005 (Fase 4 · Cassa & Vendite).
 * Invarianti: isolamento RLS su tutte le tabelle nuove; prossimo_numero esteso
 * a VE/RE (e rifiuto dei prefissi non validi); scarico da vendita che muove la
 * giacenza col trigger 003; indici unici vendite_busta_unica / vendite_lac_unica
 * (23505 sul doppio incasso); movimenti_cassa append-only (nessuna policy
 * update/delete); colonna generata chiusure_cassa.versamento; unicità
 * (azienda, data) sulle chiusure; check segno/importo.
 *
 * Le vendite si numerano SEMPRE dalla rpc (mai composte in JS, cfr. guardia L4):
 * qui i test usano `prossimo_numero('VE')` come farebbe l'app.
 */
describe.skipIf(!haEnv())("005 · Cassa & Vendite", () => {
  let A: Tenant;
  let B: Tenant;
  let clienteA: string;

  beforeAll(async () => {
    [A, B] = await Promise.all([creaTenant("csA"), creaTenant("csB")]);
    clienteA = await creaCliente(A);
  });
  afterAll(pulisci);

  async function numero(t: Tenant, prefisso: "VE" | "RE"): Promise<string> {
    const { data, error } = await t.cli.rpc("prossimo_numero", { p_prefisso: prefisso });
    expect(error).toBeNull();
    return data as string;
  }

  /* ── Numerazione estesa a VE / RE ───────────────────────────────────── */

  it("prossimo_numero accetta VE e RE nel formato PP-AAAA-NNNN", async () => {
    const ve = await numero(A, "VE");
    const re = await numero(A, "RE");
    expect(ve).toMatch(/^VE-\d{4}-\d{4}$/);
    expect(re).toMatch(/^RE-\d{4}-\d{4}$/);
  });

  it("prossimo_numero rifiuta un prefisso non valido (PREFISSO_NON_VALIDO)", async () => {
    const { error } = await A.cli.rpc("prossimo_numero", { p_prefisso: "XX" });
    expect(error).not.toBeNull();
  });

  /* ── RLS isolamento su tutte le tabelle nuove ───────────────────────── */

  it("RLS · A non vede le vendite di B", async () => {
    const num = await numero(B, "VE");
    const { data, error } = await B.cli
      .from("vendite")
      .insert({ azienda_id: B.aziendaId, numero: num, totale: 100 })
      .select("id")
      .single();
    expect(error).toBeNull();
    const idB = data!.id as string;
    const { data: vistoDaA } = await A.cli.from("vendite").select("id").eq("id", idB).maybeSingle();
    expect(vistoDaA).toBeNull();
  });

  it("RLS · A non può inserire una vendita nell'azienda di B (with check nega)", async () => {
    const num = await numero(A, "VE");
    const { error } = await A.cli
      .from("vendite")
      .insert({ azienda_id: B.aziendaId, numero: num, totale: 10 });
    expect(error).not.toBeNull();
  });

  it("RLS · A non vede i resi, le chiusure e i movimenti di cassa di B", async () => {
    const num = await numero(B, "RE");
    await B.cli.from("resi").insert({
      azienda_id: B.aziendaId,
      numero: num,
      tipo: "denaro",
      causale: "soddisfatti_rimborsati",
      importo: 30,
    });
    await B.cli.from("chiusure_cassa").insert({
      azienda_id: B.aziendaId,
      data: "2026-01-02",
      fondo_apertura: 300,
      contanti_contati: 500,
      fondo_chiusura: 300,
    });
    await B.cli.from("movimenti_cassa").insert({
      azienda_id: B.aziendaId,
      tipo: "prelievo",
      importo: 20,
      motivo: "spesa bar",
    });

    const [{ data: resi }, { data: chiusure }, { data: mov }] = await Promise.all([
      A.cli.from("resi").select("id"),
      A.cli.from("chiusure_cassa").select("id"),
      A.cli.from("movimenti_cassa").select("id"),
    ]);
    expect(resi ?? []).toEqual([]);
    expect(chiusure ?? []).toEqual([]);
    expect(mov ?? []).toEqual([]);
  });

  /* ── Scarico da vendita → trigger giacenza (003) ────────────────────── */

  it("un movimento 'scarico' (riferimento VE) abbassa la giacenza; segno positivo → rifiutato", async () => {
    const prodotto = await creaProdotto(A);
    await A.cli.from("movimenti_magazzino").insert({
      azienda_id: A.aziendaId,
      prodotto_id: prodotto,
      tipo: "carico",
      quantita: 5,
      riferimento: "Bolla",
    });
    const veNum = await numero(A, "VE");
    const { error } = await A.cli.from("movimenti_magazzino").insert({
      azienda_id: A.aziendaId,
      prodotto_id: prodotto,
      tipo: "scarico",
      quantita: -2,
      riferimento: veNum,
    });
    expect(error).toBeNull();
    const { data } = await A.cli.from("prodotti").select("giacenza").eq("id", prodotto).single();
    expect(data!.giacenza).toBe(3);

    // Il check segno/tipo di 003 vieta uno scarico con quantità positiva.
    const { error: eSegno } = await A.cli.from("movimenti_magazzino").insert({
      azienda_id: A.aziendaId,
      prodotto_id: prodotto,
      tipo: "scarico",
      quantita: 2,
    });
    expect(eSegno).not.toBeNull();
  });

  /* ── Un ordine si incassa una volta sola (indici unici parziali) ────── */

  it("vendite_busta_unica · due vendite 'emesse' sulla stessa busta → 23505", async () => {
    const { data: busta } = await A.cli
      .from("ordini_occhiali")
      .insert({ azienda_id: A.aziendaId, cliente_id: clienteA, numero: `BL-DUP-${Date.now()}`, totale: 200 })
      .select("id")
      .single();

    const primo = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "VE"),
      totale: 200,
      busta_id: busta!.id,
      stato: "emessa",
    });
    expect(primo.error).toBeNull();

    const secondo = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "VE"),
      totale: 200,
      busta_id: busta!.id,
      stato: "emessa",
    });
    expect(secondo.error?.code).toBe("23505");

    // L'indice è PARZIALE su stato='emessa': una vendita annullata libera il posto.
    const terzo = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "VE"),
      totale: 200,
      busta_id: busta!.id,
      stato: "annullata",
    });
    expect(terzo.error).toBeNull();
  });

  it("vendite_lac_unica · due vendite 'emesse' sullo stesso ordine LAC → 23505", async () => {
    const { data: lac } = await A.cli
      .from("ordini_lac")
      .insert({ azienda_id: A.aziendaId, cliente_id: clienteA, numero: `OL-DUP-${Date.now()}`, totale: 90 })
      .select("id")
      .single();

    const primo = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "VE"),
      totale: 90,
      ordine_lac_id: lac!.id,
      stato: "emessa",
    });
    expect(primo.error).toBeNull();

    const secondo = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "VE"),
      totale: 90,
      ordine_lac_id: lac!.id,
      stato: "emessa",
    });
    expect(secondo.error?.code).toBe("23505");
  });

  /* ── Movimenti di cassa: append-only (nessuna policy update/delete) ─── */

  it("movimenti_cassa · update e delete non hanno effetto — la riga resta com'era", async () => {
    const { data, error } = await A.cli
      .from("movimenti_cassa")
      .insert({ azienda_id: A.aziendaId, tipo: "spesa", importo: 15, motivo: "cancelleria" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const id = data!.id as string;

    await A.cli.from("movimenti_cassa").update({ importo: 999 }).eq("id", id);
    await A.cli.from("movimenti_cassa").delete().eq("id", id);
    const { data: rimasto } = await A.cli
      .from("movimenti_cassa")
      .select("importo")
      .eq("id", id)
      .maybeSingle();
    expect(rimasto?.importo).toBe(15);
  });

  it("movimenti_cassa · importo non positivo → rifiutato; tipo fuori lista → rifiutato", async () => {
    const eImporto = await A.cli
      .from("movimenti_cassa")
      .insert({ azienda_id: A.aziendaId, tipo: "prelievo", importo: 0, motivo: "x" });
    expect(eImporto.error).not.toBeNull();
    const eTipo = await A.cli
      .from("movimenti_cassa")
      .insert({ azienda_id: A.aziendaId, tipo: "bonifico_estero", importo: 10, motivo: "x" });
    expect(eTipo.error).not.toBeNull();
  });

  /* ── Chiusure di cassa: colonna generata + unicità (azienda, data) ──── */

  it("chiusure_cassa · versamento è generato (contanti_contati − fondo_chiusura)", async () => {
    const { data, error } = await A.cli
      .from("chiusure_cassa")
      .insert({
        azienda_id: A.aziendaId,
        data: "2026-03-10",
        fondo_apertura: 300,
        contanti_contati: 850.5,
        fondo_chiusura: 300,
      })
      .select("versamento")
      .single();
    expect(error).toBeNull();
    expect(Number(data!.versamento)).toBeCloseTo(550.5, 2);
  });

  it("chiusure_cassa · versamento è read-only: un tentativo di scriverlo fallisce", async () => {
    const { error } = await A.cli.from("chiusure_cassa").insert({
      azienda_id: A.aziendaId,
      data: "2026-03-11",
      fondo_apertura: 300,
      contanti_contati: 400,
      fondo_chiusura: 300,
      versamento: 12345,
    });
    // Le colonne GENERATED ALWAYS non accettano un valore esplicito.
    expect(error).not.toBeNull();
  });

  it("chiusure_cassa · una sola chiusura per (azienda, data) → 23505", async () => {
    const riga = {
      azienda_id: A.aziendaId,
      data: "2026-03-12",
      fondo_apertura: 300,
      contanti_contati: 500,
      fondo_chiusura: 300,
    };
    const primo = await A.cli.from("chiusure_cassa").insert(riga);
    expect(primo.error).toBeNull();
    const secondo = await A.cli.from("chiusure_cassa").insert(riga);
    expect(secondo.error?.code).toBe("23505");
  });

  /* ── Check di dominio · resi ────────────────────────────────────────── */

  it("resi · importo non positivo → rifiutato; causale fuori lista → rifiutata", async () => {
    const eImp = await A.cli.from("resi").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "RE"),
      tipo: "denaro",
      causale: "soddisfatti_rimborsati",
      importo: 0,
    });
    expect(eImp.error).not.toBeNull();
    const eCaus = await A.cli.from("resi").insert({
      azienda_id: A.aziendaId,
      numero: await numero(A, "RE"),
      tipo: "denaro",
      causale: "ho_cambiato_idea",
      importo: 10,
    });
    expect(eCaus.error).not.toBeNull();
  });
});
