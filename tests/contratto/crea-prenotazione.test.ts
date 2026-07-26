import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — Migrazione 012 (G7 · crea_prenotazione): la PRIMA scrittura
 * del portale, esposta ad `anon` ma difesa in ultima istanza dalla funzione.
 *
 * COME si esercita (stessa filosofia di slot-liberi.test.ts):
 *  • setup col SERVICE ROLE (orari/servizi/portale_attivo, appuntamenti: non
 *    producibili dalla UI pubblica);
 *  • la RPC `crea_prenotazione` si chiama da un client ANON non autenticato —
 *    è così che la tocca il browser tramite l'azione server (SECURITY DEFINER,
 *    grant ad anon). Nessun service role nella scrittura;
 *  • la LETTURA di verifica (stato/codice/contatto) passa dal SERVICE ROLE:
 *    `prenotazioni` e `persone` sono revocate all'anon (011).
 *
 * Anti-fuso: NON si costruiscono timestamp a mano. Si chiede prima a slot_liberi
 * la lista dei candidati liberi (istanti ASSOLUTI già corretti) e si prenota su
 * quegli istanti. Gli slot usati sono distanziati (≥4 passi da 15' = 60') così una
 * prenotazione da 30' non svuota lo slot del test successivo.
 *
 * ⚠️ RESIDUO APPEND-ONLY (documentato nel report): una volta creata, la
 * prenotazione NON è cancellabile (trigger before-delete 011 §7), pinna la
 * `persona` (FK on delete restrict) e blocca in cascata la delete dell'azienda.
 * Perciò il teardown è best-effort e i dati di prenotazione restano nel progetto
 * di test. Mitigazione: slug e TELEFONI unici per RUN_ID → nessuna collisione
 * sull'indice unico di `persone` fra run. Serve un gancio di pulizia lato DB
 * (RPC SECURITY DEFINER) per una bonifica vera.
 */

const TZ = "Europe/Rome";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente O 0 I 1 (come nella 012)
const RE_CODICE = new RegExp(`^LMP-[${ALFABETO}]{4}$`);

function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
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

/** Telefoni italiani UNICI per RUN_ID: cifre stabili dal run + un contatore. */
let telSeq = 0;
function telefonoUnico(): { grezzo: string; normalizzato: string } {
  // 9 cifre dopo il 3xx: derivo un blocco dal RUN_ID (base36→cifre) + contatore.
  const seed = Array.from(RUN_ID)
    .map((c) => c.charCodeAt(0) % 10)
    .join("")
    .padEnd(6, "0")
    .slice(0, 6);
  const coda = String(1000 + telSeq++).slice(-4); // 4 cifre progressive
  const nazionale = `3${seed}${coda}`.slice(0, 10); // 10 cifre totali (3 + 9)
  return { grezzo: nazionale, normalizzato: `+39${nazionale}` };
}

describe.skipIf(!haEnv())("012 · crea_prenotazione — la scrittura del portale", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let neg: Tenant; // negozio pubblicato, orari tutti i giorni 09–17, servizio visita 30'
  let giorno: string; // giorno futuro con orari (dow qualsiasi: orari su tutti i giorni)
  let candidati: string[] = []; // istanti liberi ASSOLUTI catturati PRIMA di prenotare

  // Chiave di idempotenza per ogni sotto-test (stabile per run).
  const K = (etichetta: string) => `test-${RUN_ID}-${etichetta}`;

  /** Invoca la RPC come ANON, con default sensati. Ritorna {data, error}. */
  async function crea(
    o: Partial<{
      slug: string;
      servizio: string;
      inizio: string;
      nome: string;
      telefono: string;
      email: string;
      perContoDi: string;
      note: string;
      fonte: string;
      chiave: string;
      listaAttesa: boolean;
    }>
  ) {
    return anon.rpc("crea_prenotazione", {
      p_slug: o.slug ?? neg.slug,
      p_servizio: o.servizio ?? "visita",
      p_inizio: o.inizio!,
      p_nome: o.nome ?? "Mario Prova",
      p_telefono: o.telefono ?? telefonoUnico().grezzo,
      p_email: o.email ?? "",
      p_per_conto_di: o.perContoDi ?? "",
      p_note: o.note ?? "",
      p_fonte: o.fonte ?? "qr_vetrina",
      p_chiave_richiesta: o.chiave!,
      p_lista_attesa: o.listaAttesa ?? false,
    });
  }

  /** Legge la prenotazione dal SERVICE ROLE (anon non può leggerla). */
  async function leggiPren(id: string) {
    const { data, error } = await svc.from("prenotazioni").select("*").eq("id", id).single();
    if (error) throw new Error(`leggiPren: ${error.message}`);
    return data;
  }

  async function slot(servizio: string, g: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: servizio,
      p_giorno: g,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    neg = await creaTenant("g7pren");
    await svc.from("aziende").update({ portale_attivo: true, nome_pubblico: "Ottica G7" }).eq("id", neg.aziendaId);

    // Orari su TUTTI i giorni 09–17 (finestra ampia: molti slot per il giorno F,
    // qualunque ne sia il dow). Servizio visita 30' (deroga esplicita).
    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: neg.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);
    const eS = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: neg.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);

    // Giorno futuro (dentro l'orizzonte 90gg, tutto oltre l'anticipo 2h) e i suoi
    // candidati liberi, catturati PRIMA di qualunque prenotazione.
    giorno = piuGiorni(oggiRomaISO(), 10);
    candidati = await slot("visita", giorno);
    expect(candidati.length, "il giorno F deve avere molti slot liberi").toBeGreaterThan(24);
  });

  afterAll(async () => {
    if (!haEnv()) return;
    // Best-effort: ripulisco ciò che È cancellabile (lista_attesa, appuntamenti).
    // I builder PostgREST risolvono con {error}, non lanciano: si awaita e basta.
    // prenotazioni/persone/azienda restano per progettazione (append-only + FK
    // restrict): vedi nota in testa e report-test.md.
    await svc.from("lista_attesa").delete().eq("azienda_id", neg.aziendaId);
    await svc.from("appuntamenti").delete().eq("azienda_id", neg.aziendaId);
    await pulisci().catch(() => undefined); // tenta la delete azienda; fallisce se ha prenotazioni
  });

  // ── prenotazione valida → riga in_attesa, codice, contatto, informativa ─────
  it("crea una prenotazione valida: 1 riga in_attesa, fonte, codice LMP-XXXX, contatto copiato", async () => {
    const inizio = candidati[0];
    const tel = telefonoUnico();
    const { data, error } = await crea({
      inizio,
      nome: "Anna Verdi",
      telefono: tel.grezzo,
      email: "anna@example.com",
      fonte: "qr_vetrina",
      chiave: K("valida"),
    });
    expect(error, error?.message).toBeFalsy();
    const riga = Array.isArray(data) ? data[0] : data;
    expect(riga?.codice, "il codice torna nel risultato").toMatch(RE_CODICE);
    expect(new Date(riga.inizio).getTime()).toBe(new Date(inizio).getTime());
    expect(riga.durata_minuti).toBe(30);

    const p = await leggiPren(riga.id);
    expect(p.stato, "una RICHIESTA nasce in_attesa (non confermata)").toBe("in_attesa");
    expect(p.fonte).toBe("qr_vetrina");
    expect(p.codice).toMatch(RE_CODICE);
    expect(p.contatto_nome, "il contatto è COPIATO sulla prenotazione").toBe("Anna Verdi");
    expect(p.contatto_telefono).toBe(tel.grezzo);
    expect(p.contatto_email).toBe("anna@example.com");
    expect(p.informativa_accettata_at, "informativa_accettata_at valorizzato").toBeTruthy();
  });

  // ── idempotenza: stessa chiave → una sola riga, stesso codice ───────────────
  it("idempotenza: due chiamate con la STESSA chiave_richiesta → una sola riga, stesso codice", async () => {
    const inizio = candidati[4];
    const chiave = K("idem");
    const tel = telefonoUnico();
    const r1 = await crea({ inizio, telefono: tel.grezzo, chiave });
    expect(r1.error, r1.error?.message).toBeFalsy();
    const a = (Array.isArray(r1.data) ? r1.data[0] : r1.data)!;

    // secondo invio identico (doppio tocco / rete): NON crea una seconda riga.
    const r2 = await crea({ inizio, telefono: tel.grezzo, chiave });
    expect(r2.error, r2.error?.message).toBeFalsy();
    const b = (Array.isArray(r2.data) ? r2.data[0] : r2.data)!;

    expect(b.id).toBe(a.id);
    expect(b.codice).toBe(a.codice);

    const { data: righe, error } = await svc
      .from("prenotazioni")
      .select("id")
      .eq("chiave_richiesta", chiave);
    expect(error).toBeFalsy();
    expect(righe?.length, "una sola riga per la chiave di idempotenza").toBe(1);
  });

  // ── doppio slot (chiavi diverse) → la seconda è SLOT_OCCUPATO ────────────────
  it("due chiamate sullo stesso slot con chiavi diverse → la seconda fallisce con SLOT_OCCUPATO", async () => {
    const inizio = candidati[8];
    const r1 = await crea({ inizio, chiave: K("slot-a") });
    expect(r1.error, r1.error?.message).toBeFalsy();

    const r2 = await crea({ inizio, chiave: K("slot-b") });
    expect(r2.error, "il secondo sullo stesso slot deve fallire").toBeTruthy();
    expect(r2.error!.message).toContain("SLOT_OCCUPATO");
  });

  // ── sovrapposizione con un APPUNTAMENTO del gestionale → SLOT_OCCUPATO ──────
  it("sovrapposizione con un appuntamento esistente → SLOT_OCCUPATO", async () => {
    const inizio = candidati[12];
    // seed di un appuntamento 'prenotato' su quell'istante (col service role).
    const eA = await svc.from("appuntamenti").insert({
      azienda_id: neg.aziendaId,
      utente_id: neg.userId,
      tipo: "controllo_vista",
      inizio,
      durata_minuti: 30,
      stato: "prenotato",
    });
    expect(eA.error, eA.error?.message).toBeFalsy();

    const r = await crea({ inizio, chiave: K("appt-overlap") });
    expect(r.error, "la prenotazione sopra un appuntamento deve fallire").toBeTruthy();
    expect(r.error!.message).toContain("SLOT_OCCUPATO");
  });

  // ── errori distinti di validazione ─────────────────────────────────────────
  it("fuori dagli orari di apertura → FUORI_ORARIO", async () => {
    // parto da uno slot valido (09:00) e spingo a +6h (15:00): oltre 09–17? no,
    // 15:00 è dentro 09–17. Uso invece +9h → 18:00, oltre la chiusura, stesso
    // giorno, oltre l'anticipo e dentro l'orizzonte → FUORI_ORARIO.
    const base = new Date(candidati[0]).getTime();
    const inizio = new Date(base + 9 * 60 * 60 * 1000).toISOString(); // 18:00
    const r = await crea({ inizio, chiave: K("fuori-orario") });
    expect(r.error, r.error?.message).toBeTruthy();
    expect(r.error!.message).toContain("FUORI_ORARIO");
  });

  it("oltre l'orizzonte (>90 giorni) → FUORI_ORIZZONTE", async () => {
    const inizio = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
    const r = await crea({ inizio, chiave: K("orizzonte") });
    expect(r.error, r.error?.message).toBeTruthy();
    expect(r.error!.message).toContain("FUORI_ORIZZONTE");
  });

  it("con meno dell'anticipo minimo (2h) → TROPPO_TARDI", async () => {
    const inizio = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // fra 1h
    const r = await crea({ inizio, chiave: K("troppo-tardi") });
    expect(r.error, r.error?.message).toBeTruthy();
    expect(r.error!.message).toContain("TROPPO_TARDI");
  });

  it("servizio non attivo per il negozio → SERVIZIO_NON_ATTIVO", async () => {
    const r = await crea({ servizio: "occhiale", inizio: candidati[16], chiave: K("serv-off") });
    expect(r.error, r.error?.message).toBeTruthy();
    expect(r.error!.message).toContain("SERVIZIO_NON_ATTIVO");
  });

  it("slug inesistente → NEGOZIO_NON_TROVATO", async () => {
    const r = await crea({
      slug: `test-${RUN_ID}-non-esiste`,
      inizio: candidati[16],
      chiave: K("negozio-ko"),
    });
    expect(r.error, r.error?.message).toBeTruthy();
    expect(r.error!.message).toContain("NEGOZIO_NON_TROVATO");
  });

  // ── dedup persona: stesso numero in formati diversi → una sola persona ──────
  it("stesso telefono in formati diversi → una sola persona in `persone` (dedup)", async () => {
    const tel = telefonoUnico(); // es. 3XXXXXXXXX (nazionale nudo)
    const nazionale = tel.grezzo; // "3XXXXXXXXX"
    // stesso numero, due grafie: spaziato nazionale e con prefisso internazionale.
    const grafiaA = `${nazionale.slice(0, 3)} ${nazionale.slice(3, 6)} ${nazionale.slice(6)}`;
    const grafiaB = `+39 ${nazionale.slice(0, 3)} ${nazionale.slice(3)}`;

    const rA = await crea({ inizio: candidati[16], telefono: grafiaA, chiave: K("dedup-a") });
    expect(rA.error, rA.error?.message).toBeFalsy();
    const rB = await crea({ inizio: candidati[20], telefono: grafiaB, chiave: K("dedup-b") });
    expect(rB.error, rB.error?.message).toBeFalsy();

    // Entrambe le grafie collassano su +39<nazionale>: UNA persona.
    const { data: persone, error } = await svc
      .from("persone")
      .select("id")
      .eq("telefono_normalizzato", tel.normalizzato);
    expect(error).toBeFalsy();
    expect(persone?.length, "le due grafie sono la STESSA persona").toBe(1);

    // e le due prenotazioni puntano alla stessa persona.
    const idA = (Array.isArray(rA.data) ? rA.data[0] : rA.data)!.id;
    const idB = (Array.isArray(rB.data) ? rB.data[0] : rB.data)!.id;
    const pA = await leggiPren(idA);
    const pB = await leggiPren(idB);
    expect(pA.persona_id).toBe(pB.persona_id);
  });

  // ── dopo la prenotazione, lo slot sparisce da slot_liberi ───────────────────
  it("dopo una prenotazione, slot_liberi NON restituisce più quello slot", async () => {
    const inizio = candidati[24];
    // prima è fra i liberi (lo era alla cattura iniziale, ricontrollo ADESSO).
    const prima = await slot("visita", giorno);
    expect(prima, "lo slot era libero prima di prenotarlo").toContain(inizio);

    const r = await crea({ inizio, chiave: K("consuma-slot") });
    expect(r.error, r.error?.message).toBeFalsy();

    const dopo = await slot("visita", giorno);
    expect(dopo, "lo slot prenotato non è più fra i liberi").not.toContain(inizio);
  });
});
