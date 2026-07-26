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
 * L2 · Contratto — Migrazioni 012 + 013 (G7 · crea_prenotazione / G7-bis ·
 * l'agenda unica): la PRIMA scrittura del portale, esposta ad `anon` ma difesa
 * in ultima istanza dalla funzione e dal vincolo di esclusione su `appuntamenti`.
 *
 * NOVITÀ 013 — un posto solo decide se uno slot è occupato: `appuntamenti` È LO
 * SLOT, `prenotazioni` è la pratica. `crea_prenotazione` ora scrive DUE righe
 * nella stessa transazione: prima l'APPUNTAMENTO (stato `in_attesa`), poi la
 * PRENOTAZIONE collegata (`appuntamento_id`). La difesa contro la doppia sullo
 * stesso orario vive sull'EXCLUDE di `appuntamenti`, per-risorsa e per stato
 * occupante (in_attesa/prenotato/completato). Quindi: una richiesta dal portale
 * e un appuntamento al banco NON possono finire nello stesso slot — lo impedisce
 * il database (vedi i test qui).
 *
 * NOVITÀ 014 — `risorsa_id` è prima classe: ogni appuntamento è di una SALA, ogni
 * negozio nasce con almeno la sua 'Sala 1' (trigger su `aziende`). crea_prenotazione
 * assegna la prima sala attiva libera (deterministica), e un trigger BEFORE INSERT
 * riempie `risorsa_id` quando l'insert manuale non la passa (così il NOT NULL non
 * rompe i seed «al banco» di questo file). Con UNA sala il comportamento è identico
 * alla 013: gli scenari PER-SALA (due sale in parallelo, sala disattivata) vivono in
 * `sale.test.ts`. L'EXCLUDE è ora per-risorsa SENZA coalesce (risorsa_id è NOT NULL).
 *
 * COME si esercita (stessa filosofia di slot-liberi.test.ts):
 *  • setup col SERVICE ROLE (orari/servizi/portale_attivo, appuntamenti: non
 *    producibili dalla UI pubblica);
 *  • la RPC `crea_prenotazione` si chiama da un client ANON non autenticato —
 *    è così che la tocca il browser tramite l'azione server (SECURITY DEFINER,
 *    grant ad anon). Nessun service role nella scrittura;
 *  • la LETTURA di verifica (stato/codice/contatto + l'appuntamento collegato)
 *    passa dal SERVICE ROLE: `prenotazioni` e `persone` sono revocate all'anon (011).
 *
 * Anti-fuso: NON si costruiscono timestamp a mano. Si chiede prima a slot_liberi
 * la lista dei candidati liberi (istanti ASSOLUTI già corretti) e si prenota su
 * quegli istanti. Gli slot usati sono distanziati (≥4 passi da 15' = 60') così una
 * prenotazione da 30' non svuota lo slot del test successivo; per gli scenari
 * isolati (manuale-respinto, annullato/in_attesa, risorse) si usano GIORNI diversi
 * (slot tutti freschi) per non esaurire i candidati del giorno principale.
 *
 * ⚠️ RESIDUO APPEND-ONLY (documentato nel report): una volta creata, la
 * prenotazione NON è cancellabile (trigger before-delete 011 §7), pinna la
 * `persona` (FK on delete restrict) e blocca in cascata la delete dell'azienda.
 * Con la 013 pinna ANCHE il suo appuntamento: `prenotazioni.appuntamento_id` è
 * NOT NULL con `on delete set null`, quindi cancellare l'appuntamento collegato
 * fallirebbe (violazione NOT NULL). Perciò il teardown pulisce solo gli
 * appuntamenti NON collegati (seed manuali, annullati, prove risorse) ed è
 * best-effort sul resto: i dati di prenotazione + i loro appuntamenti restano nel
 * progetto di test. Mitigazione: slug e TELEFONI unici per RUN_ID → nessuna
 * collisione fra run. Serve un gancio di pulizia lato DB (RPC SECURITY DEFINER).
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

describe.skipIf(!haEnv())("012/013 · crea_prenotazione — la scrittura del portale (agenda unica)", () => {
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

  /** Legge un appuntamento dal SERVICE ROLE (per id). */
  async function leggiAppto(id: string) {
    const { data, error } = await svc.from("appuntamenti").select("*").eq("id", id).single();
    if (error) throw new Error(`leggiAppto: ${error.message}`);
    return data;
  }

  /** Semina un appuntamento «al banco» col service role. Ritorna {error}. */
  async function seedAppto(o: {
    inizio: string;
    stato: string;
    risorsaId?: string | null;
    durata?: number;
  }) {
    return svc.from("appuntamenti").insert({
      azienda_id: neg.aziendaId,
      utente_id: neg.userId,
      tipo: "controllo_vista",
      inizio: o.inizio,
      durata_minuti: o.durata ?? 30,
      stato: o.stato,
      risorsa_id: o.risorsaId ?? null,
    });
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
    // Best-effort: ripulisco ciò che È cancellabile. I builder PostgREST risolvono
    // con {error}, non lanciano: si awaita e basta.
    await svc.from("lista_attesa").delete().eq("azienda_id", neg.aziendaId);
    // 013: gli appuntamenti COLLEGATI a una prenotazione NON si cancellano
    // (appuntamento_id è NOT NULL con on delete set null → la SET NULL fallirebbe,
    // e un unico DELETE su tutta l'azienda salterebbe anche i non-collegati). Perciò
    // elimino solo gli appuntamenti NON referenziati (seed manuali, annullati, prove
    // risorse). Quelli in_attesa nati dalle prenotazioni restano, come le prenotazioni.
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
    // prenotazioni/persone/azienda + i loro appuntamenti restano per progettazione
    // (append-only + FK restrict/not-null): vedi nota in testa e report-test.md.
    await pulisci().catch(() => undefined); // tenta la delete azienda; fallisce se ha prenotazioni
  });

  // ── prenotazione valida → DUE righe (appuntamento in_attesa + prenotazione) ──
  it("crea una prenotazione valida: DUE righe collegate — appuntamento in_attesa + prenotazione", async () => {
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

    // 1) la PRENOTAZIONE (la pratica)
    const p = await leggiPren(riga.id);
    expect(p.stato, "una RICHIESTA nasce in_attesa (non confermata)").toBe("in_attesa");
    expect(p.fonte).toBe("qr_vetrina");
    expect(p.codice).toMatch(RE_CODICE);
    expect(p.contatto_nome, "il contatto è COPIATO sulla prenotazione").toBe("Anna Verdi");
    expect(p.contatto_telefono).toBe(tel.grezzo);
    expect(p.contatto_email).toBe("anna@example.com");
    expect(p.informativa_accettata_at, "informativa_accettata_at valorizzato").toBeTruthy();

    // 2) l'APPUNTAMENTO (lo slot), COLLEGATO alla prenotazione (013)
    expect(p.appuntamento_id, "la prenotazione punta a un appuntamento").toBeTruthy();
    const a = await leggiAppto(p.appuntamento_id);
    expect(a.stato, "lo slot nasce in_attesa (nessuno l'ha confermato)").toBe("in_attesa");
    expect(a.azienda_id).toBe(neg.aziendaId);
    expect(new Date(a.inizio).getTime(), "stesso istante della richiesta").toBe(
      new Date(inizio).getTime()
    );
    expect(a.durata_minuti).toBe(30);
    // 014: `risorsa_id` è ora prima classe. crea_prenotazione assegna la PRIMA
    // sala attiva libera (deterministica): con la sola 'Sala 1' del negozio la
    // colonna è valorizzata (non più nulla come nella 013).
    expect(a.risorsa_id, "014: crea_prenotazione assegna una sala attiva → risorsa_id valorizzato").toBeTruthy();
    expect(a.cliente_id, "una richiesta dal portale non ha ancora un cliente").toBeNull();
    expect(a.fonte, "la fonte del canale attraversa anche l'appuntamento").toBe("qr_vetrina");
    // il collegamento è biunivoco: la coppia condivide lo stesso codice leggibile
    expect(a.riferimento, "l'appuntamento porta il codice della pratica").toBe(p.codice);
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
      .select("id, appuntamento_id")
      .eq("chiave_richiesta", chiave);
    expect(error).toBeFalsy();
    expect(righe?.length, "una sola riga per la chiave di idempotenza").toBe(1);

    // 013: il secondo invio esce PRIMA di scrivere → nessun appuntamento orfano.
    // Su quell'istante/azienda deve esserci ESATTAMENTE un appuntamento, ed è
    // quello collegato all'unica prenotazione.
    const { data: appti, error: eA } = await svc
      .from("appuntamenti")
      .select("id")
      .eq("azienda_id", neg.aziendaId)
      .eq("inizio", inizio);
    expect(eA).toBeFalsy();
    expect(appti?.length, "nessun appuntamento orfano dal doppio invio").toBe(1);
    expect(appti?.[0]?.id, "l'unico appuntamento è quello collegato").toBe(
      righe?.[0]?.appuntamento_id
    );
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

  /* ══════════════════════════════════════════════════════════════════════════
   * 013 · L'AGENDA UNICA — un posto solo decide se uno slot è occupato.
   * Scenari isolati su GIORNI diversi (slot tutti freschi): non tolgono candidati
   * al giorno principale. Prima slot del giorno = index 0.
   * ══════════════════════════════════════════════════════════════════════════ */

  /** Primo slot libero di un giorno dedicato (fresco). */
  async function primoSlot(offsetGiorni: number): Promise<string> {
    const g = piuGiorni(oggiRomaISO(), offsetGiorni);
    const s = await slot("visita", g);
    expect(s.length, `il giorno +${offsetGiorni} ha slot liberi`).toBeGreaterThan(0);
    return s[0];
  }

  // ── IL CASO CHE HA MOTIVATO LA CONSEGNA ─────────────────────────────────────
  // Richiesta dal portale su uno slot → un appuntamento MANUALE (banco) sullo
  // stesso slot/azienda è respinto DAL DATABASE (l'EXCLUDE di appuntamenti), non
  // dalla funzione. È la garanzia dell'agenda unica: non si presentano in due.
  it("richiesta dal portale + appuntamento manuale sullo stesso slot → RESPINTO dal database", async () => {
    const inizio = await primoSlot(30);

    // 1) la richiesta dal portale crea il suo appuntamento in_attesa
    const r = await crea({ inizio, chiave: K("agenda-unica-portale") });
    expect(r.error, r.error?.message).toBeFalsy();

    // 2) l'ottico prova a mettere un cliente al banco sullo STESSO slot: stato
    //    'prenotato', risorsa_id null (poltrona unica) → violazione di esclusione.
    const eManuale = await seedAppto({ inizio, stato: "prenotato", risorsaId: null });
    expect(
      eManuale.error,
      "l'appuntamento manuale sullo slot già impegnato deve essere rifiutato"
    ).toBeTruthy();
    // 23P01 = exclusion_violation (il vincolo appuntamenti_niente_sovrapposizioni).
    expect(
      eManuale.error!.code === "23P01" || /exclu/i.test(eManuale.error!.message),
      `atteso exclusion_violation, avuto ${eManuale.error!.code}: ${eManuale.error!.message}`
    ).toBe(true);
  });

  // ── annullato non blocca; in_attesa sì ──────────────────────────────────────
  it("un appuntamento 'annullato' sullo slot NON blocca; l'in_attesa nato dalla richiesta sì", async () => {
    const inizio = await primoSlot(31);

    // un appuntamento ANNULLATO sullo slot: NON occupa (fuori dal WHERE dell'EXCLUDE)
    const eAnn = await seedAppto({ inizio, stato: "annullato", risorsaId: null });
    expect(eAnn.error, "un annullato può stare sullo slot").toBeFalsy();

    // la richiesta passa (l'annullato non la blocca) e nasce il suo in_attesa
    const r1 = await crea({ inizio, chiave: K("annullato-non-blocca") });
    expect(r1.error, "l'annullato non impedisce la richiesta").toBeFalsy();

    // ora sullo slot c'è un in_attesa: una seconda richiesta è SLOT_OCCUPATO
    const r2 = await crea({ inizio, chiave: K("in-attesa-blocca") });
    expect(r2.error, "l'in_attesa occupa lo slot").toBeTruthy();
    expect(r2.error!.message).toContain("SLOT_OCCUPATO");
  });

  // ── due risorse diverse in parallelo: ammesse (SPOSTATO in sale.test.ts) ─────
  // 014: `risorsa_id` ha ora una FK verso `risorse` (e il NOT NULL), quindi non si
  // possono più iniettare UUID inventati con `crypto.randomUUID()`. Lo scenario
  // «due sale in parallelo sullo stesso slot → ammesse; il terzo → respinto» vive
  // ora in `sale.test.ts`, che crea sale VERE nella tabella `risorse`.

  // ── risorsa nulla su entrambi: il secondo è respinto (unica sala assegnata) ─
  it("due appuntamenti sullo stesso slot con risorsa_id NULLA → il secondo è respinto", async () => {
    const inizio = await primoSlot(33);

    // 014: il trigger BEFORE INSERT assegna la sala quando l'insert non la passa.
    // Con la sola 'Sala 1' del negozio, entrambi finiscono in quella sala.
    const e1 = await seedAppto({ inizio, stato: "prenotato", risorsaId: null });
    expect(e1.error, "primo appuntamento (sala assegnata dal trigger)").toBeFalsy();

    const e2 = await seedAppto({ inizio, stato: "prenotato", risorsaId: null });
    expect(e2.error, "unica sala: il secondo sullo stesso slot è rifiutato").toBeTruthy();
    expect(
      e2.error!.code === "23P01" || /exclu/i.test(e2.error!.message),
      `atteso exclusion_violation, avuto ${e2.error!.code}: ${e2.error!.message}`
    ).toBe(true);
  });
});
