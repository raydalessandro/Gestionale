import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — Migrazione 010 (G5 · orari, servizi e chiusure del portale).
 *
 * Le invarianti di vetrina che devono reggere anche a chiave anon:
 *  • 010-01: l'anon LEGGE le tre viste pubbliche (orari_pubblici, servizi_pubblici,
 *    chiusure_pubbliche) SOLO per un negozio pubblicato (portale_attivo=true);
 *  • 010-02: un negozio NON pubblicato non compare in nessuna delle tre viste;
 *  • 010-03: l'anon NON legge le tabelle sottostanti (servizi, negozi_servizi,
 *    orari_apertura, chiusure, blocchi_slot): la select è REVOCATA → errore di
 *    permesso, non 0 righe;
 *  • 010-04: chiusure_pubbliche NON espone `motivo` (fatto interno del negozio).
 *
 * Setup col SERVICE ROLE: orari/servizi/chiusure non sono producibili dalla UI
 * pubblica, e portale_attivo si imposta direttamente su aziende. Il catalogo
 * globale `servizi` è già popolato dalla 010: si usa un codice esistente.
 */
describe.skipIf(!haEnv())("010 · Orari, servizi e chiusure del portale", () => {
  let svc: SupabaseClient;
  let pub: Tenant; // negozio PUBBLICATO (portale_attivo=true)
  let off: Tenant; // negozio SPENTO (portale_attivo=false)

  beforeAll(async () => {
    svc = serviceClient();
    pub = await creaTenant("g5pub");
    off = await creaTenant("g5off");

    // Vetrina accesa su `pub`, spenta su `off`.
    await svc.from("aziende").update({ portale_attivo: true }).eq("id", pub.aziendaId);
    await svc.from("aziende").update({ portale_attivo: false }).eq("id", off.aziendaId);

    // Semina identica sui due negozi: solo la pubblicazione li distingue.
    for (const t of [pub, off]) {
      const orari = await svc.from("orari_apertura").insert([
        { azienda_id: t.aziendaId, giorno: 1, apre: "09:00", chiude: "13:00" },
        { azienda_id: t.aziendaId, giorno: 1, apre: "15:00", chiude: "19:30" },
      ]);
      if (orari.error) throw new Error(`seed orari: ${orari.error.message}`);

      const serv = await svc.from("negozi_servizi").insert([
        { azienda_id: t.aziendaId, servizio_codice: "visita", attivo: true },
        { azienda_id: t.aziendaId, servizio_codice: "occhiale", attivo: true },
      ]);
      if (serv.error) throw new Error(`seed servizi: ${serv.error.message}`);

      const chi = await svc.from("chiusure").insert({
        azienda_id: t.aziendaId,
        dal: "2099-08-01",
        al: "2099-08-20",
        motivo: "Ferie estive",
      });
      if (chi.error) throw new Error(`seed chiusure: ${chi.error.message}`);
    }
  });
  afterAll(pulisci);

  // ── 010-01 · l'anon legge le tre viste per il negozio pubblicato ──────────
  it("orari_pubblici: l'anon vede le fasce del negozio pubblicato", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("orari_pubblici")
      .select("slug, giorno, apre, chiude")
      .eq("slug", pub.slug);
    expect(error).toBeFalsy();
    expect((data ?? []).length, "le due fasce del lunedì devono comparire").toBe(2);
    for (const r of data ?? []) expect(r.slug).toBe(pub.slug);
  });

  it("servizi_pubblici: l'anon vede i servizi attivi con la durata ereditata dal catalogo", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("servizi_pubblici")
      .select("slug, codice, etichetta, durata_minuti, ordine")
      .eq("slug", pub.slug);
    expect(error).toBeFalsy();
    const codici = (data ?? []).map((r) => r.codice).sort();
    expect(codici).toEqual(["occhiale", "visita"]);
    // Durata predefinita del catalogo (nessuna deroga): visita=30, occhiale=45.
    const visita = (data ?? []).find((r) => r.codice === "visita");
    expect(visita?.durata_minuti).toBe(30);
  });

  it("chiusure_pubbliche: l'anon vede il periodo di ferie del negozio pubblicato", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("chiusure_pubbliche")
      .select("slug, dal, al")
      .eq("slug", pub.slug);
    expect(error).toBeFalsy();
    expect((data ?? []).length).toBe(1);
    expect((data ?? [])[0]?.dal).toBe("2099-08-01");
  });

  // ── 010-02 · il negozio NON pubblicato non compare in nessuna vista ───────
  it("un negozio spento (portale_attivo=false) è invisibile alle tre viste", async () => {
    const anon = anonClient();
    for (const vista of ["orari_pubblici", "servizi_pubblici", "chiusure_pubbliche"]) {
      const { data, error } = await anon.from(vista).select("slug").eq("slug", off.slug);
      expect(error, `select su ${vista} non deve errare`).toBeFalsy();
      expect((data ?? []).length, `${vista} non deve mostrare un negozio spento`).toBe(0);
    }
  });

  // ── 010-03 · le tabelle sottostanti sono chiuse all'anon (revoke) ─────────
  it("l'anon NON legge le tabelle sottostanti: select REVOCATA → errore di permesso", async () => {
    const anon = anonClient();
    for (const tab of ["servizi", "negozi_servizi", "orari_apertura", "chiusure", "blocchi_slot"]) {
      const r = await anon.from(tab).select("*").limit(1);
      expect(r.error, `la select su ${tab} deve fallire per revoke, non tornare righe`).toBeTruthy();
    }
  });

  // ── 010-04 · chiusure_pubbliche non espone il motivo ──────────────────────
  it("chiusure_pubbliche NON espone la colonna `motivo`", async () => {
    const anon = anonClient();
    const r = await anon.from("chiusure_pubbliche").select("motivo").eq("slug", pub.slug).limit(1);
    expect(r.error, "`motivo` non deve esistere nella vista di vetrina").toBeTruthy();
  });
});
