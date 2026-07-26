import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, pulisci, haEnv, RUN_ID, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — Migrazione 009 (G3-bis · vocabolario `fonte` sugli ordini).
 *
 * La 009 ridefinisce il check `fonte` su `ordini_lac` e `ordini_occhiali` al
 * vocabolario `banco, app, convenzione, qr_vetrina, sito_negozio, portale`
 * (= Exclude<Fonte,"import">). Il vecchio valore `'sito'` è ritirato; `'import'`
 * non è ammesso sugli ordini.
 *
 * Qui esercitiamo il CHECK a valle del DB usando il client autenticato del
 * tenant (t.cli): l'inserimento deve rispettare la RLS (azienda_id = propria)
 * e superare o meno il constraint a seconda del valore di `fonte`.
 *
 * Campi minimi obbligatori (NOT NULL senza default) su entrambe le tabelle:
 *   azienda_id, numero, fonte. `numero` ha un unique per azienda → valori
 *   distinti per ogni riga. cliente_id/prescrizione_id restano null (evitano
 *   qualsiasi interferenza col trigger di coerenza tenant DB-01).
 */
describe.skipIf(!haEnv())("009 · Vocabolario fonte sugli ordini", () => {
  let A: Tenant;
  let contatore = 0;

  // numero unico per azienda: prefisso di run + contatore incrementale.
  function numero(prefisso: string): string {
    contatore += 1;
    return `${prefisso}-${RUN_ID}-${contatore}`;
  }

  async function inserisciLac(fonte: string) {
    return A.cli
      .from("ordini_lac")
      .insert({ azienda_id: A.aziendaId, numero: numero("OL"), fonte })
      .select("id");
  }

  async function inserisciOcchiali(fonte: string) {
    return A.cli
      .from("ordini_occhiali")
      .insert({ azienda_id: A.aziendaId, numero: numero("BL"), fonte })
      .select("id");
  }

  beforeAll(async () => {
    A = await creaTenant("fonte");
  });
  afterAll(pulisci);

  // ── 1 · valore del nuovo vocabolario → ACCETTATO ───────────────────────
  it("ordini_lac: fonte='sito_negozio' è accettato", async () => {
    const r = await inserisciLac("sito_negozio");
    expect(r.error, r.error?.message).toBeFalsy();
    expect((r.data ?? []).length).toBe(1);
  });

  it("ordini_occhiali: fonte='sito_negozio' è accettato", async () => {
    const r = await inserisciOcchiali("sito_negozio");
    expect(r.error, r.error?.message).toBeFalsy();
    expect((r.data ?? []).length).toBe(1);
  });

  // ── 4 (opzionale) · altro valore del nuovo vocabolario → ACCETTATO ─────
  it("ordini_lac: fonte='portale' è accettato", async () => {
    const r = await inserisciLac("portale");
    expect(r.error, r.error?.message).toBeFalsy();
    expect((r.data ?? []).length).toBe(1);
  });

  it("ordini_occhiali: fonte='qr_vetrina' è accettato", async () => {
    const r = await inserisciOcchiali("qr_vetrina");
    expect(r.error, r.error?.message).toBeFalsy();
    expect((r.data ?? []).length).toBe(1);
  });

  // ── 2 · valore ritirato 'sito' → RESPINTO dal check ────────────────────
  it("ordini_lac: fonte='sito' (ritirato) è respinto dal check", async () => {
    const r = await inserisciLac("sito");
    expect(r.error, "il check 009 deve respingere il valore ritirato 'sito'").toBeTruthy();
  });

  it("ordini_occhiali: fonte='sito' (ritirato) è respinto dal check", async () => {
    const r = await inserisciOcchiali("sito");
    expect(r.error, "il check 009 deve respingere il valore ritirato 'sito'").toBeTruthy();
  });

  // ── 3 · 'import' non ammesso sugli ordini → RESPINTO dal check ─────────
  it("ordini_lac: fonte='import' (non ammesso sugli ordini) è respinto dal check", async () => {
    const r = await inserisciLac("import");
    expect(r.error, "gli ordini non si importano: 'import' fuori dal vocabolario").toBeTruthy();
  });

  it("ordini_occhiali: fonte='import' (non ammesso sugli ordini) è respinto dal check", async () => {
    const r = await inserisciOcchiali("import");
    expect(r.error, "gli ordini non si importano: 'import' fuori dal vocabolario").toBeTruthy();
  });
});
