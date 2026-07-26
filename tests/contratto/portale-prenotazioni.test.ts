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
 * L2 · Contratto — Migrazione 011 (G6 · prenotazioni: sicurezza e accessi).
 *
 * Le invarianti di riservatezza del modello di identità (011 §8):
 *  • 011-01: l'anon può CALCOLARE gli slot (rpc slot_liberi, security definer),
 *    e riceve un array — mai un errore di permesso;
 *  • 011-02: l'anon NON legge le tabelle riservate (persone, prenotazioni,
 *    lista_attesa, registro): la select è REVOCATA → errore, non 0 righe;
 *  • 011-03: il negozio autenticato legge le PROPRIE prenotazioni, ma NON legge
 *    `persone` né il registro (RLS senza policy → 0 righe / accesso negato);
 *  • 011-04: un negozio NON pubblicato (portale_attivo=false) → slot_liberi
 *    ritorna un array vuoto (il gate è la pubblicazione, non i dati).
 *
 * L'algoritmo di slot_liberi vive in SQL (security definer) perché solo così
 * l'anon ottiene il calcolo senza leggere appuntamenti/prenotazioni/blocchi che
 * gli sono revocati: i casi "sull'algoritmo" sono quindi in slot-liberi.test.ts
 * (contratto), non unit. Setup col SERVICE ROLE: orari/servizi/portale_attivo e
 * la coppia persona+prenotazione non sono producibili dalla UI pubblica.
 */

const TZ = "Europe/Rome";

/** «Oggi» come data di parete a Roma (YYYY-MM-DD). */
function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Somma n giorni a una data ISO, ancorando a mezzogiorno per non scivolare. */
function piuGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Giorno della settimana (0=domenica … 6=sabato) del giorno di calendario. */
function dow(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

describe.skipIf(!haEnv())("011 · Prenotazioni — sicurezza e accessi", () => {
  let svc: SupabaseClient;
  let pub: Tenant; // negozio PUBBLICATO, con orari + servizio + una prenotazione
  let off: Tenant; // negozio SPENTO (portale_attivo=false), stessa semina
  let giorno: string; // un giorno futuro il cui dow ha orari sui due negozi

  beforeAll(async () => {
    svc = serviceClient();
    pub = await creaTenant("g6pub");
    off = await creaTenant("g6off");

    await svc.from("aziende").update({ portale_attivo: true, nome_pubblico: "Ottica Pub" }).eq("id", pub.aziendaId);
    await svc.from("aziende").update({ portale_attivo: false }).eq("id", off.aziendaId);

    // Un giorno futuro (dentro l'orizzonte 90gg, oltre l'anticipo 2h) con orari.
    giorno = piuGiorni(oggiRomaISO(), 7);
    const g = dow(giorno);
    for (const t of [pub, off]) {
      const o = await svc
        .from("orari_apertura")
        .insert({ azienda_id: t.aziendaId, giorno: g, apre: "09:00", chiude: "13:00" });
      if (o.error) throw new Error(`seed orari: ${o.error.message}`);
      const s = await svc
        .from("negozi_servizi")
        .insert({ azienda_id: t.aziendaId, servizio_codice: "visita", attivo: true });
      if (s.error) throw new Error(`seed servizio: ${s.error.message}`);
    }

    // Una persona (di Limpidia) + una prenotazione del negozio `pub`. Il contatto
    // è COPIATO sulla prenotazione: l'ottico lo vede senza leggere `persone`.
    const persona = await svc
      .from("persone")
      .insert({ telefono_grezzo: "340 111 2233", nome: "Mario Prova" })
      .select("id, telefono_normalizzato")
      .single();
    if (persona.error) throw new Error(`seed persona: ${persona.error.message}`);
    // il telefono normalizzato è GENERATO: '340 111 2233' → '+393401112233'
    expect(persona.data.telefono_normalizzato).toBe("+393401112233");

    const pren = await svc.from("prenotazioni").insert({
      azienda_id: pub.aziendaId,
      persona_id: persona.data.id,
      servizio_codice: "visita",
      inizio: "2099-05-01T09:00:00Z",
      durata_minuti: 30,
      contatto_nome: "Mario Prova",
      contatto_telefono: "340 111 2233",
    });
    if (pren.error) throw new Error(`seed prenotazione: ${pren.error.message}`);
  });
  afterAll(pulisci);

  // ── 011-01 · l'anon calcola gli slot e riceve un array ─────────────────────
  it("l'anon chiama slot_liberi e ottiene un array (mai errore di permesso)", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: pub.slug,
      p_servizio: "visita",
      p_giorno: giorno,
    });
    expect(error, "slot_liberi è security definer, eseguibile da anon").toBeFalsy();
    expect(Array.isArray(data), "setof timestamptz → array").toBe(true);
    // con orari e servizio attivi, un giorno futuro libero produce degli slot
    expect((data as string[]).length).toBeGreaterThan(0);
  });

  // ── 011-02 · l'anon NON legge le tabelle riservate (revoke, non 0 righe) ────
  it("l'anon NON legge persone/prenotazioni/lista_attesa/registro: select REVOCATA", async () => {
    const anon = anonClient();
    for (const tab of ["persone", "prenotazioni", "lista_attesa", "persone_riferimento_registro"]) {
      const r = await anon.from(tab).select("*").limit(1);
      expect(r.error, `la select su ${tab} deve fallire per revoke`).toBeTruthy();
    }
  });

  // ── 011-03 · il negozio legge le PROPRIE prenotazioni ──────────────────────
  it("il negozio autenticato legge le proprie prenotazioni", async () => {
    const r = await pub.cli.from("prenotazioni").select("id, contatto_nome").eq("azienda_id", pub.aziendaId);
    expect(r.error).toBeFalsy();
    expect((r.data ?? []).length, "la prenotazione seminata è del suo tenant").toBeGreaterThanOrEqual(1);
    expect((r.data ?? [])[0]?.contatto_nome).toBe("Mario Prova");
  });

  it("il negozio autenticato NON legge `persone` né il registro (0 righe / accesso negato)", async () => {
    for (const tab of ["persone", "persone_riferimento_registro"]) {
      const r = await pub.cli.from(tab).select("*").limit(1);
      // RLS attiva SENZA policy: nessun errore ma ZERO righe (oppure select negata).
      const nessunAccesso = Boolean(r.error) || (r.data ?? []).length === 0;
      expect(nessunAccesso, `il negozio non deve vedere righe di ${tab}`).toBe(true);
    }
  });

  // ── 011-04 · negozio spento → slot_liberi vuoto (il gate è la pubblicazione) ─
  it("un negozio NON pubblicato → slot_liberi ritorna un array vuoto", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: off.slug,
      p_servizio: "visita",
      p_giorno: giorno,
    });
    expect(error).toBeFalsy();
    expect(Array.isArray(data)).toBe(true);
    expect((data as string[]).length, "spento = niente slot, pur avendo orari").toBe(0);
  });

  // ── Sentinella IMMUTABLE (gemella di diag_intervallo_immutabile) ───────────
  // Perché conta: `persone.telefono_normalizzato` è una colonna GENERATA da
  // `normalizza_telefono`, con INDICE UNICO sopra. Se qualcuno riscrive la
  // funzione (es. per un prefisso estero) senza una migrazione di ricalcolo, le
  // righe vecchie tengono la vecchia normalizzazione: la STESSA persona si
  // sdoppia sotto l'unique, e nessun altro test diventa rosso. Questa sentinella
  // lo grida: la funzione deve restare IMMUTABLE (provolatile 'i', requisito
  // della colonna generata/indice) e conservare la forma del corpo.
  it("normalizza_telefono resta IMMUTABLE e con il corpo atteso (+39)", async () => {
    const { data, error } = await svc.rpc("diag_normalizza_telefono");
    expect(error).toBeFalsy();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row?.volatile_immutabile, "provolatile deve essere 'i' (IMMUTABLE)").toBe(true);
    expect(row?.corpo_ok, "il corpo deve restare regexp_replace + prefisso +39").toBe(true);
  });
});
