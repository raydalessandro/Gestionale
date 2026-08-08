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
 * L2 · Contratto — Migrazione 017 (I servizi di tipo «richiesta»).
 *
 * Il portale impara che un servizio ha DUE forme:
 *  • appuntamento — durata, slot, un appuntamento in agenda (comportamento pre-017);
 *  • richiesta    — NIENTE durata, NIENTE slot: «Occhiali da sole», «Le mie lenti a
 *    contatto», «Riparazione». Il negozio risponde entro 24 ore.
 *
 * Gli invarianti della §7, esercitati contro il DB vero:
 *  1. slot_liberi su un servizio richiesta → insieme VUOTO (guardia esplicita), da anon;
 *  2. crea_prenotazione su un servizio richiesta → prenotazione con appuntamento_id/
 *     inizio/durata_minuti NULL, note valorizzate, e NESSUN appuntamento creato;
 *  3. due richieste dello stesso servizio sullo stesso negozio (telefoni diversi) →
 *     entrambe passano (non c'è slot da contendere);
 *  4. insert diretta di una prenotazione su servizio APPUNTAMENTO senza appuntamento_id
 *     → respinta dal trigger trg_coerenza_prenotazione_tipo (P0001);
 *  5. insert diretta di una prenotazione su servizio RICHIESTA con appuntamento_id
 *     → respinta dallo stesso trigger (P0001);
 *  6. insert/update su `servizi` con tipo richiesta e durata valorizzata → respinta
 *     dal check servizi_durata_per_tipo (23514);
 *  7. negozi_servizi con servizio richiesta + durata_minuti valorizzata → respinta dal
 *     trigger trg_coerenza_negozio_servizio (P0001);
 *  + la vista pubblica servizi_pubblici ora espone anche `tipo` (visibile ad anon).
 *
 * COME si esercita (stessa filosofia del resto del contratto portale):
 *  • setup col SERVICE ROLE (portale_attivo/orari/negozi_servizi/appuntamenti: non
 *    producibili dalla UI pubblica);
 *  • le RPC (slot_liberi, crea_prenotazione) si chiamano da ANON non autenticato —
 *    è così che le tocca il browser via l'azione server (security definer, grant anon);
 *  • le LETTURE di verifica passano dal SERVICE ROLE (prenotazioni/persone revocate
 *    ad anon, 011);
 *  • i casi «insert diretta» (4/5) usano il SERVICE ROLE: i trigger di coerenza fanno
 *    fuoco comunque (i trigger scattano indipendentemente dalla RLS).
 *
 * Servizio APPUNTAMENTO usato: `visita` (30'). Servizio RICHIESTA usato: `sole` (che
 * la 017 ha ritipizzato a richiesta, durata nulla). Un secondo richiesta `riparazione`
 * serve al caso 7 (negozi_servizi con durata su richiesta).
 *
 * ⚠️ RESIDUO APPEND-ONLY (come crea-prenotazione.test.ts): una prenotazione, una volta
 * creata, non è cancellabile (trigger no-delete 011) e pinna la persona (FK restrict) →
 * il teardown è best-effort; i dati restano nel progetto di test. Slug e telefoni unici
 * per RUN_ID evitano collisioni fra run.
 */

const TZ = "Europe/Rome";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

/**
 * Telefoni italiani UNICI per RUN_ID (niente collisioni sull'indice unico di
 * `persone.telefono_normalizzato`). NB: 10 cifre esatte — `3` + seed(5) + coda(4).
 * Il seed è a 5 cifre di proposito: con 6 il numero finiva a 11 cifre e lo
 * `slice(0,10)` tagliava l'ultima cifra della coda, rendendo NON unici i primi
 * telSeq (invisibile agli altri file, che passano da crea_prenotazione e
 * deduplicano la persona; qui invece si fanno insert DIRETTI su `persone`).
 */
let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): { grezzo: string; normalizzato: string } {
  const nazionale = `3${TEL_BASE}${String(telSeq++).padStart(2, "0")}`; // 10 cifre, base=ms avvio: unica tra run e suite
  return { grezzo: nazionale, normalizzato: `+39${nazionale}` };
}

describe.skipIf(!haEnv())("017 · Servizi di tipo «richiesta»", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let neg: Tenant; // negozio pubblicato, orari 09–17 tutti i giorni, visita (appto) + sole (richiesta)
  let giorno: string;

  const K = (etichetta: string) => `test-${RUN_ID}-017-${etichetta}`;

  /** Invoca crea_prenotazione come ANON, con default sensati. Ritorna {data, error}. */
  async function crea(
    o: Partial<{
      slug: string;
      servizio: string;
      inizio: string | null;
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
      p_servizio: o.servizio ?? "sole",
      p_inizio: o.inizio ?? null,
      p_nome: o.nome ?? "Mario Prova",
      p_telefono: o.telefono ?? telefonoUnico().grezzo,
      p_email: o.email ?? "",
      p_per_conto_di: o.perContoDi ?? "",
      p_note: o.note ?? "",
      p_fonte: o.fonte ?? "portale",
      p_chiave_richiesta: o.chiave!,
      p_lista_attesa: o.listaAttesa ?? false,
    });
  }

  /** Legge una prenotazione dal SERVICE ROLE (anon non può leggerla). */
  async function leggiPren(id: string) {
    const { data, error } = await svc.from("prenotazioni").select("*").eq("id", id).single();
    if (error) throw new Error(`leggiPren: ${error.message}`);
    return data;
  }

  /** Conta gli appuntamenti del tenant (service role). */
  async function contaAppuntamenti(): Promise<number> {
    const { count, error } = await svc
      .from("appuntamenti")
      .select("id", { count: "exact", head: true })
      .eq("azienda_id", neg.aziendaId);
    if (error) throw new Error(`contaAppuntamenti: ${error.message}`);
    return count ?? 0;
  }

  /** Crea una persona col service role (per gli insert diretti). Ritorna l'id. */
  async function creaPersona(): Promise<string> {
    const tel = telefonoUnico();
    const { data, error } = await svc
      .from("persone")
      .insert({ telefono_grezzo: tel.grezzo, nome: "Persona 017" })
      .select("id")
      .single();
    if (error) throw new Error(`creaPersona: ${error.message}`);
    return data.id as string;
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    neg = await creaTenant("g17req");
    await svc
      .from("aziende")
      .update({ portale_attivo: true, nome_pubblico: "Ottica 017" })
      .eq("id", neg.aziendaId);

    // Orari su tutti i giorni 09–17: molti slot per il servizio appuntamento.
    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: neg.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);

    // Attivo un servizio APPUNTAMENTO (visita) e uno RICHIESTA (sole). La richiesta
    // NON porta durata_minuti (il trigger di coerenza la vieterebbe).
    const eS = await svc.from("negozi_servizi").insert([
      { azienda_id: neg.aziendaId, servizio_codice: "visita", attivo: true },
      { azienda_id: neg.aziendaId, servizio_codice: "sole", attivo: true },
    ]);
    if (eS.error) throw new Error(`seed servizi: ${eS.error.message}`);

    giorno = piuGiorni(oggiRomaISO(), 9);
  });

  afterAll(async () => {
    if (!haEnv()) return;
    await svc.from("lista_attesa").delete().eq("azienda_id", neg.aziendaId);
    // Solo gli appuntamenti NON collegati a una prenotazione (i seed manuali): quelli
    // collegati non si cancellano (appuntamento_id set null → NOT NULL... qui però le
    // prenotazioni richiesta non hanno appuntamento; i seed diretti 4/5 sì).
    const { data: prens } = await svc
      .from("prenotazioni")
      .select("appuntamento_id")
      .eq("azienda_id", neg.aziendaId);
    const collegati = (prens ?? [])
      .map((p) => p.appuntamento_id as string | null)
      .filter((x): x is string => Boolean(x));
    let q = svc.from("appuntamenti").delete().eq("azienda_id", neg.aziendaId);
    if (collegati.length) q = q.not("id", "in", `(${collegati.join(",")})`);
    await q;
    await pulisci().catch(() => undefined);
  });

  // ── 1 · slot_liberi su una RICHIESTA → array VUOTO (guardia esplicita) ──────
  it("slot_liberi su un servizio di tipo richiesta → insieme vuoto (anon)", async () => {
    // controprova: il servizio APPUNTAMENTO del negozio ha davvero degli slot,
    // così il vuoto della richiesta è per il TIPO, non per una cattiva semina.
    const appto = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_giorno: giorno,
    });
    expect(appto.error, appto.error?.message).toBeFalsy();
    expect((appto.data as string[]).length, "la visita (appuntamento) offre slot").toBeGreaterThan(0);

    const richiesta = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "sole",
      p_giorno: giorno,
    });
    expect(richiesta.error, "slot_liberi è security definer: mai errore di permesso").toBeFalsy();
    expect(Array.isArray(richiesta.data)).toBe(true);
    expect((richiesta.data as string[]).length, "una richiesta non ha slot da offrire").toBe(0);
  });

  // ── 2 · crea_prenotazione su una RICHIESTA → niente slot/appuntamento ───────
  it("crea_prenotazione su un servizio richiesta → appuntamento_id/inizio/durata NULL, note valorizzate, nessun appuntamento", async () => {
    const primaAppti = await contaAppuntamenti();
    const nota = "Vorrei occhiali da sole polarizzati, taglia media";
    const { data, error } = await crea({
      servizio: "sole",
      inizio: null, // p_inizio è IGNORATO nel ramo richiesta
      nome: "Anna Verdi",
      note: nota,
      fonte: "portale",
      chiave: K("richiesta-ok"),
    });
    expect(error, error?.message).toBeFalsy();
    const riga = Array.isArray(data) ? data[0] : data;
    expect(riga?.codice, "il codice torna nel risultato").toMatch(RE_CODICE);
    expect(riga?.inizio, "una richiesta non ha inizio").toBeNull();
    expect(riga?.durata_minuti, "una richiesta non ha durata").toBeNull();

    const p = await leggiPren(riga.id);
    expect(p.appuntamento_id, "una richiesta non genera un appuntamento").toBeNull();
    expect(p.inizio, "inizio NULL sulla riga").toBeNull();
    expect(p.durata_minuti, "durata NULL sulla riga").toBeNull();
    expect(p.note, "il testo libero finisce nelle note").toBe(nota);
    expect(p.stato, "una richiesta nasce in_attesa").toBe("in_attesa");
    expect(p.servizio_codice).toBe("sole");
    expect(p.contatto_nome).toBe("Anna Verdi");
    expect(p.informativa_accettata_at, "informativa_accettata_at valorizzato").toBeTruthy();

    const dopoAppti = await contaAppuntamenti();
    expect(dopoAppti, "il ramo richiesta NON crea appuntamenti").toBe(primaAppti);
  });

  // ── 3 · due richieste dello stesso servizio, telefoni diversi → entrambe OK ─
  it("due richieste dello stesso servizio sullo stesso negozio (telefoni diversi) → entrambe passano", async () => {
    const r1 = await crea({ servizio: "sole", telefono: telefonoUnico().grezzo, chiave: K("due-a") });
    expect(r1.error, r1.error?.message).toBeFalsy();
    const r2 = await crea({ servizio: "sole", telefono: telefonoUnico().grezzo, chiave: K("due-b") });
    expect(r2.error, "niente slot da contendere: la seconda passa").toBeFalsy();

    const a = (Array.isArray(r1.data) ? r1.data[0] : r1.data)!;
    const b = (Array.isArray(r2.data) ? r2.data[0] : r2.data)!;
    expect(a.id).not.toBe(b.id);
    expect(a.codice).not.toBe(b.codice);

    // due prenotazioni distinte per le due chiavi
    const { data: righe, error } = await svc
      .from("prenotazioni")
      .select("id")
      .in("chiave_richiesta", [K("due-a"), K("due-b")]);
    expect(error).toBeFalsy();
    expect(righe?.length, "due richieste = due righe").toBe(2);
  });

  // ── 4 · insert diretta su APPUNTAMENTO senza appuntamento_id → P0001 ────────
  it("insert diretta di prenotazione su servizio APPUNTAMENTO senza appuntamento_id → respinta (P0001)", async () => {
    const persona = await creaPersona();
    const tel = telefonoUnico();
    const { error } = await svc.from("prenotazioni").insert({
      azienda_id: neg.aziendaId,
      persona_id: persona,
      servizio_codice: "visita", // appuntamento → pretende appuntamento_id/inizio/durata
      appuntamento_id: null,
      inizio: null,
      durata_minuti: null,
      contatto_nome: "Tizio Incompleto",
      contatto_telefono: tel.grezzo,
    });
    expect(error, "il trigger di coerenza deve respingere").toBeTruthy();
    expect(error!.code, "raise exception → P0001").toBe("P0001");
    expect(error!.message).toContain("PRENOTAZIONE_APPUNTAMENTO_INCOMPLETA");
  });

  // ── 5 · insert diretta su RICHIESTA con appuntamento_id → P0001 ────────────
  it("insert diretta di prenotazione su servizio RICHIESTA con appuntamento_id → respinta (P0001)", async () => {
    // Un appuntamento VERO dello stesso tenant: così l'unico a poter obiettare è il
    // trigger di coerenza TIPO (non quello di coerenza tenant né la FK).
    const inizio = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
    const { data: appto, error: eA } = await svc
      .from("appuntamenti")
      .insert({
        azienda_id: neg.aziendaId,
        utente_id: neg.userId,
        tipo: "controllo_vista",
        inizio,
        durata_minuti: 30,
        stato: "prenotato",
        risorsa_id: null, // il trigger 014 assegna la Sala 1
      })
      .select("id")
      .single();
    expect(eA, eA?.message).toBeFalsy();

    const persona = await creaPersona();
    const tel = telefonoUnico();
    const { error } = await svc.from("prenotazioni").insert({
      azienda_id: neg.aziendaId,
      persona_id: persona,
      servizio_codice: "sole", // richiesta → NON ammette appuntamento/inizio/durata
      appuntamento_id: appto!.id,
      inizio: null,
      durata_minuti: null,
      contatto_nome: "Caio ConSlot",
      contatto_telefono: tel.grezzo,
    });
    expect(error, "il trigger di coerenza deve respingere").toBeTruthy();
    expect(error!.code, "raise exception → P0001").toBe("P0001");
    expect(error!.message).toContain("PRENOTAZIONE_RICHIESTA_CON_SLOT");
  });

  // ── 6 · check servizi_durata_per_tipo: richiesta + durata → 23514 ──────────
  it("servizi: tipo richiesta con durata valorizzata → respinta dal check (23514)", async () => {
    // insert di un codice usa-e-getta: il check fa fuoco, la riga NON persiste.
    const insert = await svc.from("servizi").insert({
      codice: `test-${RUN_ID}-ric`,
      etichetta: "Servizio richiesta fasullo",
      tipo: "richiesta",
      durata_predefinita_minuti: 30, // vietato per una richiesta
      ordine: 999,
    });
    expect(insert.error, "il check deve respingere l'insert").toBeTruthy();
    expect(insert.error!.code, "check_violation").toBe("23514");
    expect(insert.error!.message).toContain("servizi_durata_per_tipo");

    // update su una richiesta ESISTENTE del catalogo: dare una durata a `sole` è
    // vietato → l'update FALLISCE (nessuna mutazione del catalogo globale).
    const update = await svc
      .from("servizi")
      .update({ durata_predefinita_minuti: 30 })
      .eq("codice", "sole");
    expect(update.error, "dare durata a un richiesta è vietato").toBeTruthy();
    expect(update.error!.code).toBe("23514");
    expect(update.error!.message).toContain("servizi_durata_per_tipo");

    // controprova: `sole` è ANCORA una richiesta senza durata (l'update non è passato).
    const { data: sole } = await svc
      .from("servizi")
      .select("tipo, durata_predefinita_minuti")
      .eq("codice", "sole")
      .single();
    expect(sole?.tipo).toBe("richiesta");
    expect(sole?.durata_predefinita_minuti, "resta NULL: l'update è stato respinto").toBeNull();
  });

  // ── 7 · negozi_servizi: richiesta + durata_minuti → P0001 ──────────────────
  it("negozi_servizi: servizio richiesta con durata_minuti valorizzata → respinta (P0001)", async () => {
    // `riparazione` è una richiesta non ancora attivata sul negozio: la attivo CON
    // una durata → il trigger di coerenza negozio↔servizio deve respingere.
    const { error } = await svc.from("negozi_servizi").insert({
      azienda_id: neg.aziendaId,
      servizio_codice: "riparazione",
      durata_minuti: 45, // vietato: la richiesta non ha durata
      attivo: true,
    });
    expect(error, "il trigger deve respingere la durata su una richiesta").toBeTruthy();
    expect(error!.code, "raise exception → P0001").toBe("P0001");
    expect(error!.message).toContain("SERVIZIO_RICHIESTA_SENZA_DURATA");
  });

  // ── + · la vista pubblica espone `tipo` (leggibile da anon) ────────────────
  it("servizi_pubblici espone `tipo` e distingue appuntamento/richiesta (anon)", async () => {
    const { data, error } = await anon
      .from("servizi_pubblici")
      .select("codice, tipo, durata_minuti")
      .eq("slug", neg.slug);
    expect(error, "la vista pubblica è leggibile da anon").toBeFalsy();
    const per = new Map((data ?? []).map((r) => [r.codice as string, r]));
    expect(per.get("visita")?.tipo, "visita è un appuntamento").toBe("appuntamento");
    expect(per.get("visita")?.durata_minuti, "l'appuntamento ha una durata").toBeTruthy();
    expect(per.get("sole")?.tipo, "sole è una richiesta").toBe("richiesta");
    expect(per.get("sole")?.durata_minuti, "la richiesta non ha durata").toBeNull();
  });
});
