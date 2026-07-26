import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  creaCliente,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — Migrazione 008 (G2 · sicurezza e isolamento tenant).
 * Verifica le difese che devono reggere anche quando il DB è raggiunto dal
 * SERVICE ROLE, che bypassa la RLS:
 *  • DB-01: trigger di coerenza tenant sulle FK incrociate
 *  • DB-02: anon non legge le tabelle; legge solo la vista negozi_pubblici
 *  • DB-03: la vista mostra solo i negozi con portale_attivo = true
 *  • DB-04: nessuna sovrapposizione di appuntamenti nella stessa azienda
 * Le prove "con service role" usano di proposito la service key: è lì che la
 * RLS non protegge più e deve subentrare il vincolo DB.
 */
describe.skipIf(!haEnv())("008 · Sicurezza e isolamento tenant", () => {
  let svc: SupabaseClient;
  let A: Tenant;
  let B: Tenant;
  let clienteA: string;
  let clienteB: string;

  // Slot lontani nel futuro: dentro un tenant nuovo sono liberi per costruzione.
  const base = "2099-03-01T09:00:00Z";
  const base10 = "2099-03-01T09:10:00Z"; // sovrapposto a base (30')
  const base40 = "2099-03-01T09:40:00Z"; // adiacente, non sovrapposto

  async function appuntamento(
    client: SupabaseClient,
    aziendaId: string,
    utenteId: string,
    extra: Record<string, unknown> = {}
  ) {
    return client
      .from("appuntamenti")
      .insert({
        azienda_id: aziendaId,
        utente_id: utenteId,
        tipo: "controllo_vista",
        inizio: base,
        durata_minuti: 30,
        stato: "prenotato",
        ...extra,
      })
      .select("id");
  }

  beforeAll(async () => {
    svc = serviceClient();
    A = await creaTenant("secA");
    B = await creaTenant("secB");
    clienteA = await creaCliente(A);
    clienteB = await creaCliente(B);
  });
  afterAll(pulisci);

  // ── DB-02 · anon non legge le tabelle protette ─────────────────────────
  it("un anon NON legge le tabelle riservate", async () => {
    const anon = anonClient();
    // aziende: la SELECT è revocata → errore di permesso
    const az = await anon.from("aziende").select("id").limit(1);
    expect(az.error, "anon su aziende deve fallire (revoke)").toBeTruthy();

    // le altre: RLS senza policy per anon → zero righe (i dati di A/B esistono)
    for (const tab of ["clienti", "appuntamenti", "prescrizioni", "ordini_lac", "ordini_occhiali", "prodotti"]) {
      const r = await anon.from(tab).select("*").limit(1);
      expect((r.data ?? []).length, `anon non deve leggere ${tab}`).toBe(0);
    }
  });

  // ── DB-02/03 · vista pubblica: solo negozi attivi, colonne di sola vetrina ──
  it("negozi_pubblici mostra solo i negozi con portale_attivo=true", async () => {
    // A pubblicato, B no
    await svc.from("aziende").update({ portale_attivo: true }).eq("id", A.aziendaId);
    await svc.from("aziende").update({ portale_attivo: false }).eq("id", B.aziendaId);

    const anon = anonClient();
    const { data, error } = await anon.from("negozi_pubblici").select("slug");
    expect(error).toBeFalsy();
    const slugs = (data ?? []).map((r) => r.slug);
    expect(slugs).toContain(A.slug);
    expect(slugs).not.toContain(B.slug);
  });

  it("negozi_pubblici NON espone le colonne vietate (verifica sui nomi)", async () => {
    const anon = anonClient();
    for (const col of ["id", "partita_iva", "ragione_sociale", "email", "stato_abbonamento", "moduli_attivi", "data_scadenza", "telefono"]) {
      const r = await anon.from("negozi_pubblici").select(col).limit(1);
      expect(r.error, `la colonna ${col} non deve esistere nella vista`).toBeTruthy();
    }
    // le colonne di vetrina invece esistono
    const ok = await anon.from("negozi_pubblici").select("slug, nome_pubblico, tagline, brand").limit(1);
    expect(ok.error).toBeFalsy();
  });

  // ── DB-01 · coerenza tenant, anche col service role ────────────────────
  it("service role: appuntamento di A che punta a un cliente di B → respinto", async () => {
    const r = await appuntamento(svc, A.aziendaId, A.userId, {
      cliente_id: clienteB,
      inizio: "2099-04-01T09:00:00Z",
    });
    expect(r.error, "il trigger DB-01 deve respingere la FK cross-tenant").toBeTruthy();
  });

  it("service role: appuntamento coerente (cliente della stessa azienda) → accettato", async () => {
    const r = await appuntamento(svc, A.aziendaId, A.userId, {
      cliente_id: clienteA,
      inizio: "2099-04-02T09:00:00Z",
    });
    expect(r.error).toBeFalsy();
  });

  // ── DB-04 · nessuna sovrapposizione ────────────────────────────────────
  it("service role: due appuntamenti sovrapposti nella STESSA azienda → il 2° respinto", async () => {
    const r1 = await appuntamento(svc, A.aziendaId, A.userId, { inizio: base });
    expect(r1.error).toBeFalsy();
    const r2 = await appuntamento(svc, A.aziendaId, A.userId, { inizio: base10 });
    expect(r2.error, "il vincolo DB-04 deve respingere la sovrapposizione").toBeTruthy();
  });

  it("appuntamenti sovrapposti in aziende DIVERSE → entrambi accettati", async () => {
    // stesso istante base in B: non deve collidere con quello di A
    const r = await appuntamento(svc, B.aziendaId, B.userId, { inizio: base });
    expect(r.error).toBeFalsy();
  });

  // ── Sentinella IMMUTABLE (richiesta in review) ─────────────────────────
  it("appuntamento_intervallo resta IMMUTABLE e in minuti", async () => {
    // Se qualcuno la riscrive con giorni/mesi, resta marcata IMMUTABLE ma
    // l'indice GIST diventa silenziosamente sbagliato: questa sentinella lo grida.
    const { data, error } = await svc.rpc("diag_intervallo_immutabile");
    expect(error).toBeFalsy();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row?.volatile_immutabile, "provolatile deve essere 'i' (IMMUTABLE)").toBe(true);
    expect(row?.corpo_minuti, "il corpo deve ancora usare interval '1 minute'").toBe(true);
  });

  it("un appuntamento ANNULLATO non blocca lo slot", async () => {
    // annullato sovrapposto a base in A (dove base è già occupato da 'prenotato')
    const rAnn = await appuntamento(svc, A.aziendaId, A.userId, { inizio: base10, stato: "annullato" });
    expect(rAnn.error, "lo stato annullato è fuori dal vincolo").toBeFalsy();
    // e uno nuovo 'prenotato' adiacente (non sovrapposto) passa
    const rAdj = await appuntamento(svc, A.aziendaId, A.userId, { inizio: base40 });
    expect(rAdj.error).toBeFalsy();
  });
});
