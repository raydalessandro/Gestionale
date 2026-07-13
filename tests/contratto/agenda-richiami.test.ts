import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2 · Contratto — Migrazione 004 (Fase 3 · Agenda & Richiami).
 * Invarianti: isolamento RLS su appuntamenti/richiami, trigger updated_at,
 * check di dominio su tipo/stato (appuntamenti) e tipo/esito/canale (richiami).
 */
describe.skipIf(!haEnv())("004 · Agenda & Richiami", () => {
  let A: Tenant;
  let B: Tenant;
  let clienteA: string;
  let clienteB: string;

  beforeAll(async () => {
    [A, B] = await Promise.all([creaTenant("agA"), creaTenant("agB")]);
    [clienteA, clienteB] = await Promise.all([creaCliente(A), creaCliente(B)]);
  });
  afterAll(pulisci);

  /* ── RLS isolamento ─────────────────────────────────────────────────── */

  it("RLS · A non vede gli appuntamenti di B", async () => {
    const { data, error } = await B.cli
      .from("appuntamenti")
      .insert({ azienda_id: B.aziendaId, cliente_id: clienteB, inizio: new Date().toISOString() })
      .select("id")
      .single();
    expect(error).toBeNull();
    const idB = data!.id as string;

    // A: la select non trova nulla, l'update non tocca la riga di B.
    const { data: vistoDaA } = await A.cli.from("appuntamenti").select("id").eq("id", idB).maybeSingle();
    expect(vistoDaA).toBeNull();
    await A.cli.from("appuntamenti").update({ note: "intruso" }).eq("id", idB);
    const { data: rimasto } = await B.cli.from("appuntamenti").select("note").eq("id", idB).single();
    expect(rimasto?.note).not.toBe("intruso");
  });

  it("RLS · A non può inserire un appuntamento nell'azienda di B (with check nega)", async () => {
    const { error } = await A.cli
      .from("appuntamenti")
      .insert({ azienda_id: B.aziendaId, cliente_id: clienteB, inizio: new Date().toISOString() });
    expect(error).not.toBeNull();
  });

  it("RLS · A non vede i richiami di B", async () => {
    const { data, error } = await B.cli
      .from("richiami")
      .insert({ azienda_id: B.aziendaId, cliente_id: clienteB, tipo: "generico" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const idB = data!.id as string;
    const { data: vistoDaA } = await A.cli.from("richiami").select("id").eq("id", idB).maybeSingle();
    expect(vistoDaA).toBeNull();
  });

  /* ── Trigger updated_at ─────────────────────────────────────────────── */

  it("trigger · l'update di un appuntamento aggiorna updated_at", async () => {
    const { data, error } = await A.cli
      .from("appuntamenti")
      .insert({ azienda_id: A.aziendaId, cliente_id: clienteA, inizio: new Date().toISOString() })
      .select("id, updated_at")
      .single();
    expect(error).toBeNull();
    const prima = new Date(data!.updated_at as string).getTime();

    const { data: dopo } = await A.cli
      .from("appuntamenti")
      .update({ note: "spostato" })
      .eq("id", data!.id)
      .select("updated_at")
      .single();
    expect(new Date(dopo!.updated_at as string).getTime()).toBeGreaterThan(prima);
  });

  it("trigger · l'update di un richiamo aggiorna updated_at", async () => {
    const { data, error } = await A.cli
      .from("richiami")
      .insert({ azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "generico" })
      .select("id, updated_at")
      .single();
    expect(error).toBeNull();
    const prima = new Date(data!.updated_at as string).getTime();

    const { data: dopo } = await A.cli
      .from("richiami")
      .update({ note: "richiamato" })
      .eq("id", data!.id)
      .select("updated_at")
      .single();
    expect(new Date(dopo!.updated_at as string).getTime()).toBeGreaterThan(prima);
  });

  /* ── Check di dominio · appuntamenti ────────────────────────────────── */

  it("appuntamenti · tipo fuori lista → rifiutato", async () => {
    const { error } = await A.cli.from("appuntamenti").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      inizio: new Date().toISOString(),
      tipo: "teletrasporto",
    });
    expect(error).not.toBeNull();
  });

  it("appuntamenti · stato fuori lista → rifiutato", async () => {
    const { error } = await A.cli.from("appuntamenti").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      inizio: new Date().toISOString(),
      stato: "forse",
    });
    expect(error).not.toBeNull();
  });

  it("appuntamenti · durata fuori 5–240 → rifiutata (bordo)", async () => {
    const { error } = await A.cli.from("appuntamenti").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      inizio: new Date().toISOString(),
      durata_minuti: 4,
    });
    expect(error).not.toBeNull();
  });

  /* ── Check di dominio · richiami ────────────────────────────────────── */

  it("richiami · tipo fuori lista → rifiutato", async () => {
    const { error } = await A.cli.from("richiami").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      tipo: "telepatia",
    });
    expect(error).not.toBeNull();
  });

  it("richiami · esito fuori lista → rifiutato", async () => {
    const { error } = await A.cli.from("richiami").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      tipo: "generico",
      esito: "boh",
    });
    expect(error).not.toBeNull();
  });

  it("richiami · canale fuori lista → rifiutato", async () => {
    const { error } = await A.cli.from("richiami").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      tipo: "generico",
      canale: "piccione",
    });
    expect(error).not.toBeNull();
  });

  it("richiami · un esito valido con canale valido → accettato", async () => {
    const { error } = await A.cli.from("richiami").insert({
      azienda_id: A.aziendaId,
      cliente_id: clienteA,
      tipo: "controllo_vista",
      canale: "telefono",
      esito: "appuntamento_fissato",
      fatto_il: new Date().toISOString(),
      valore: 120,
    });
    expect(error).toBeNull();
  });
});
