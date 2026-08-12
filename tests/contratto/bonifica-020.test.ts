import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  creaCliente,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — S0 · Bonifica (Era 2, migrazione 020).
 *
 * La 020 non aggiunge funzioni: TOGLIE privilegi. È il tipo di migrazione che
 * non si vede finché non rompe qualcosa. Quindi qui si prova, dal lato del
 * client vero, che:
 *
 *  1. `anon` non ha PIÙ alcun privilegio su NESSUNA tabella di `public`
 *     (permesso negato, 42501 — non «zero righe» dalla RLS: è la differenza fra
 *     «la RLS salva» e «anon non arriva nemmeno alla porta»);
 *  2. `_riparazioni_dati` (il marker che impedisce di ri-armare la riparazione
 *     del fuso, 019) è chiuso ad anon E ad authenticated, ma la riga
 *     `019_fuso_appuntamenti_banco` c'è ancora;
 *  3. **VP-01** — le quattro viste del portale restano leggibili da `anon` e le
 *     due RPC (`slot_liberi`, `crea_prenotazione`) restano invocabili. È ciò che
 *     la 020 poteva rompere: `revoke ... on all tables` avrebbe portato via anche
 *     le viste. Qui non si guarda il GRANT (lo fa già la guardia (f) dentro la
 *     migrazione): si fa la SELECT vera e si pretende il DATO. Una vista girata
 *     a `security_invoker = true` passerebbe il grant e romperebbe il portale;
 *     questo test no.
 *  4. le funzioni-trigger non sono più eseguibili da anon ma i TRIGGER SCATTANO
 *     lo stesso (Postgres non controlla EXECUTE quando un trigger parte):
 *     `crea_sala_default` dà la sala al negozio nato DOPO la 020,
 *     `assegna_sala_appuntamento` riempie `risorsa_id`, `assicura_coerenza_tenant`
 *     continua a dare **23514** (mai 23503 — regola del patto);
 *  5. la policy di `risorse`, ricreata `to authenticated`, non ha chiuso fuori il
 *     negozio (un drop+create sbagliato lo avrebbe fatto in silenzio);
 *  6. `_infra_migrazioni` esiste, è chiuso ad anon e porta la storia 001 → 020.
 *
 * NOTA sul catalogo (`pg_class.relrowsecurity`, `has_function_privilege`): NON è
 * raggiungibile dal client PostgREST nemmeno col service role (PostgREST espone
 * solo `public`; `pg_catalog` no, e non esiste una RPC che lo interroghi). I due
 * test che lo richiedono usano una connessione Postgres diretta, gated su
 * `TEST_SUPABASE_DB_URL` (oggi non fra i segreti di CI: skippano puliti). Tutto
 * il resto — la parte che davvero difende il prodotto — gira coi tre segreti
 * standard. Vedi «Ganci richiesti» in docs/agenti/report-test.md.
 */

/** Tutte le tabelle di `public` (schema.sql + migrazioni 002→020). */
const TABELLE = [
  "_infra_migrazioni",
  "_riparazioni_dati",
  "ambiente",
  "appuntamenti",
  "aziende",
  "blocchi_slot",
  "chiusure",
  "chiusure_cassa",
  "clienti",
  "contatori",
  "fermi",
  "lista_attesa",
  "metodi_pagamento",
  "movimenti_cassa",
  "movimenti_magazzino",
  "negozi_servizi",
  "orari_apertura",
  "ordini_lac",
  "ordini_occhiali",
  "persone",
  "persone_riferimento_registro",
  "prenotazioni",
  "prescrizioni",
  "prodotti",
  "resi",
  "richiami",
  "risorse",
  "servizi",
  "utenti",
  "vendite",
] as const;

/** VP-01: le quattro viste che tengono in piedi il portale pubblico. */
const VISTE_PORTALE = [
  "negozi_pubblici",
  "orari_pubblici",
  "chiusure_pubbliche",
  "servizi_pubblici",
] as const;

/** La storia che il registro deve contenere dopo la 020 (backfill 001 → 020). */
const MIGRAZIONI_ATTESE = [
  "001_schema_base",
  "002_ordini_buste",
  "003_catalogo_magazzino",
  "004_agenda_richiami",
  "005_cassa_vendite",
  "006_anagrafiche",
  "007_caparra_incasso",
  "008_sicurezza_tenant",
  "009_fonte_ordini",
  "010_orari_servizi",
  "011_prenotazioni",
  "012_crea_prenotazione",
  "013_agenda_unica",
  "014_sale",
  "015_ambiente_test",
  "016_fix_crea_prenotazione_id_ambiguo",
  "017_servizi_richiesta",
  "018_prendi_come_cliente",
  "019_fuso_appuntamenti_banco",
  "020_bonifica",
] as const;

const TZ = "Europe/Rome";
function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
function piuGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(d);
}

// Telefono unico per run: 3 + 3 cifre di run + 6 di contatore = 10 cifre esatte
// (coda intera: il taglio a 10 collasserebbe contatori diversi sullo stesso
// numero e l'indice unico di `persone` farebbe litigare i run fra loro).
let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): string {
  // Base = ms di avvio del run: unica TRA i run e TRA le suite. La vecchia
  // base (RUN_ID %10) collideva tra run diversi e, con l'indice parziale al
  // suo posto, la collisione non esplode piu all'INSERT: aggancia per DEDUP
  // la persona sporca di un run/suite precedente (visto in CI: g8b riceveva
  // "Prova Bonifica", la persona della suite contratto). 10 cifre esatte.
  return `3${TEL_BASE}${String(telSeq++).padStart(2, "0")}`;
}

/**
 * Catalogo di sistema: solo via connessione Postgres diretta. `pg` è già una
 * devDependency (scripts/applica-migrazioni.ts); l'import è dinamico così non
 * pesa quando questi due test skippano.
 */
// SOLO `TEST_SUPABASE_DB_URL`: nessun fallback su `SUPABASE_DB_URL` (che in una
// shell di lavoro può puntare alla PRODUZIONE — il contratto non la tocca mai).
const DB_URL = process.env.TEST_SUPABASE_DB_URL;

async function catalogo<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const { Client } = await import("pg");
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const r = await c.query(sql);
    return r.rows as T[];
  } finally {
    await c.end();
  }
}

describe.skipIf(!haEnv())("020 · Bonifica — igiene dei grant senza spegnere il portale", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let neg: Tenant; // negozio PUBBLICATO, nato DOPO la 020 (prova i trigger)
  let altro: Tenant; // secondo tenant, per la coerenza cross-tenant
  let clienteAltro: string;
  let giorno: string;
  let candidati: string[] = [];

  async function slot(g: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_giorno: g,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();

    // Il tenant nasce ORA: la sua 'Sala 1' è la prova che `crea_sala_default`
    // scatta anche dopo che la 020 ha revocato l'EXECUTE ad anon/PUBLIC.
    neg = await creaTenant("s0neg");
    altro = await creaTenant("s0alt");
    clienteAltro = await creaCliente(altro);

    await svc
      .from("aziende")
      .update({ portale_attivo: true, nome_pubblico: `Ottica S0 ${RUN_ID}` })
      .eq("id", neg.aziendaId);

    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: neg.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);

    const eS = await svc.from("negozi_servizi").insert({
      azienda_id: neg.aziendaId,
      servizio_codice: "visita",
      durata_minuti: 30,
      attivo: true,
    });
    if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);

    const eC = await svc.from("chiusure").insert({
      azienda_id: neg.aziendaId,
      dal: "2099-08-01",
      al: "2099-08-20",
      motivo: "Ferie estive",
    });
    if (eC.error) throw new Error(`seed chiusure: ${eC.error.message}`);

    giorno = piuGiorni(oggiRomaISO(), 14);
    candidati = await slot(giorno);
  });

  afterAll(async () => {
    if (!haEnv()) return;
    await svc.from("lista_attesa").delete().eq("azienda_id", neg?.aziendaId);
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
    await svc.from("appuntamenti").delete().eq("azienda_id", altro?.aziendaId);
    await pulisci().catch(() => undefined);
  });

  // ══ 1 · igiene dei grant: anon non tocca NESSUNA tabella ═══════════════════

  it("anon NON legge `clienti`/`vendite`/`prodotti`: permesso NEGATO (42501), non «zero righe»", async () => {
    // È il cuore della 020. Prima: select concessa + RLS senza policy per anon →
    // 200 con []. Ora: nessun privilegio → 42501. La differenza conta perché una
    // policy scritta male (o una tabella nuova senza policy) tornava a essere
    // leggibile in silenzio; senza grant non c'è policy distratta che tenga.
    for (const tab of ["clienti", "vendite", "prodotti"]) {
      const r = await anon.from(tab).select("*").limit(1);
      expect(r.error, `anon non deve poter interrogare ${tab}`).toBeTruthy();
      expect(
        r.error?.code,
        `su ${tab} anon deve prendere un permesso negato (42501), non una select vuota`
      ).toBe("42501");
      expect((r.data ?? []).length).toBe(0);
    }
  });

  it("anon non ha privilegi su NESSUNA delle 30 tabelle di public", async () => {
    for (const tab of TABELLE) {
      const r = await anon.from(tab).select("*").limit(1);
      expect(r.error, `anon non deve leggere ${tab}`).toBeTruthy();
      expect((r.data ?? []).length, `anon non deve ottenere righe da ${tab}`).toBe(0);
    }
  });

  it("anon non SCRIVE: insert su `clienti` respinta dal privilegio (non dalla sola RLS)", async () => {
    const r = await anon
      .from("clienti")
      .insert({ azienda_id: neg.aziendaId, nome: "Intruso", cognome: `X ${RUN_ID}` });
    expect(r.error, "anon non deve poter inserire clienti").toBeTruthy();
  });

  // ══ 2 · `_riparazioni_dati` — il marker che non si deve poter togliere ═════

  it("`_riparazioni_dati`: anon non lo legge", async () => {
    const r = await anon.from("_riparazioni_dati").select("chiave").limit(1);
    expect(r.error, "il marker non è affare del pubblico").toBeTruthy();
    expect((r.data ?? []).length).toBe(0);
  });

  it("`_riparazioni_dati`: nemmeno il negozio AUTENTICATO lo legge (grant revocato)", async () => {
    const r = await neg.cli.from("_riparazioni_dati").select("chiave").limit(1);
    const nessunAccesso = Boolean(r.error) || (r.data ?? []).length === 0;
    expect(nessunAccesso, "solo il service role arriva al marker").toBe(true);
  });

  it("`_riparazioni_dati`: nemmeno il negozio autenticato lo CANCELLA (ri-armerebbe la 019)", async () => {
    const r = await neg.cli
      .from("_riparazioni_dati")
      .delete()
      .eq("chiave", "019_fuso_appuntamenti_banco")
      .select("chiave");
    const nienteCancellato = Boolean(r.error) || (r.data ?? []).length === 0;
    expect(nienteCancellato, "cancellare il marker ri-armerebbe lo slittamento di 2 ore").toBe(true);

    // controprova col service role: la riga è ancora lì.
    const { data } = await svc
      .from("_riparazioni_dati")
      .select("chiave")
      .eq("chiave", "019_fuso_appuntamenti_banco");
    expect((data ?? []).length, "il marker della 019 deve essere sopravvissuto").toBe(1);
  });

  it("`_riparazioni_dati`: la riga `019_fuso_appuntamenti_banco` esiste ancora (service role)", async () => {
    const { data, error } = await svc
      .from("_riparazioni_dati")
      .select("chiave, quando")
      .eq("chiave", "019_fuso_appuntamenti_banco")
      .maybeSingle();
    expect(error, error?.message).toBeFalsy();
    expect(data?.chiave, "senza questa riga la 019 si rieseguirebbe e sposterebbe due volte").toBe(
      "019_fuso_appuntamenti_banco"
    );
  });

  it.skipIf(!DB_URL)("`_riparazioni_dati`: RLS ATTIVA nel catalogo (relrowsecurity) e senza policy", async () => {
    const righe = await catalogo<{ rls: boolean; policy: string }>(
      `select c.relrowsecurity as rls, coalesce(count(p.polname)::text,'0') as policy
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         left join pg_policy p on p.polrelid = c.oid
        where n.nspname = 'public' and c.relname = '_riparazioni_dati'
        group by c.relrowsecurity`
    );
    expect(righe.length, "la tabella marker deve esistere").toBe(1);
    expect(righe[0].rls, "RLS deve essere ATTIVA su _riparazioni_dati").toBe(true);
    expect(righe[0].policy, "RLS senza policy: nessuno passa tranne il service role").toBe("0");
  });

  // ══ 3 · VP-01 — il portale pubblico è ancora in piedi ══════════════════════

  it("VP-01 · le quattro viste del portale rispondono ad anon SENZA errore", async () => {
    // Il test che salva il prodotto. `revoke ... on all tables in schema public`
    // comprende le viste: se qualcuno lo riscrive così, qui diventa rosso prima
    // che diventi rosso il negozio.
    for (const vista of VISTE_PORTALE) {
      const r = await anon.from(vista).select("slug").limit(1);
      expect(
        r.error,
        `VP-01 VIOLATA: anon non legge più ${vista} — il portale pubblico è spento`
      ).toBeFalsy();
    }
  });

  it("VP-01 · le quattro viste restituiscono i DATI del negozio pubblicato (non solo 200 vuoti)", async () => {
    // «Nessun errore» non basta: una vista girata a security_invoker=true
    // risponderebbe 200 con zero righe (anon non ha più le tabelle sotto) e la
    // guardia (f) della 020 — che controlla il GRANT — non se ne accorgerebbe.
    const neg2 = await anon.from("negozi_pubblici").select("slug, nome_pubblico").eq("slug", neg.slug);
    expect(neg2.error, neg2.error?.message).toBeFalsy();
    expect((neg2.data ?? []).length, "il negozio pubblicato deve comparire in vetrina").toBe(1);

    const orari = await anon.from("orari_pubblici").select("slug, giorno, apre").eq("slug", neg.slug);
    expect(orari.error, orari.error?.message).toBeFalsy();
    expect((orari.data ?? []).length, "i 7 giorni di orario devono arrivare al portale").toBe(7);

    const serv = await anon.from("servizi_pubblici").select("slug, codice, tipo").eq("slug", neg.slug);
    expect(serv.error, serv.error?.message).toBeFalsy();
    expect((serv.data ?? []).map((r) => r.codice)).toContain("visita");

    const chiu = await anon.from("chiusure_pubbliche").select("slug, dal, al").eq("slug", neg.slug);
    expect(chiu.error, chiu.error?.message).toBeFalsy();
    expect((chiu.data ?? []).length, "le ferie pubblicate devono arrivare al portale").toBe(1);
  });

  it("VP-01 · `slot_liberi` è ancora invocabile da anon e offre slot", async () => {
    expect(candidati.length, "un giorno futuro 09–17 deve produrre slot").toBeGreaterThan(0);
    const r = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_giorno: piuGiorni(giorno, 1),
    });
    expect(r.error, "slot_liberi è security definer: anon deve poterla eseguire").toBeFalsy();
    expect(Array.isArray(r.data)).toBe(true);
  });

  it("VP-01 · `crea_prenotazione` scrive ancora da anon (definer su tabelle ormai chiuse)", async () => {
    // La prova più severa: la RPC scrive in `persone`/`prenotazioni`/`appuntamenti`,
    // dove dopo la 020 anon non ha NULLA. Se non fosse security definer (o se
    // qualcuno le togliesse l'EXECUTE), il marciapiede resterebbe muto.
    const inizio = candidati[candidati.length - 1];
    expect(inizio, "serve almeno uno slot libero per la prova").toBeTruthy();

    const { data, error } = await anon.rpc("crea_prenotazione", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_inizio: inizio,
      p_nome: "Prova Bonifica",
      p_telefono: telefonoUnico(),
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: "qr_vetrina",
      p_chiave_richiesta: `s0-${RUN_ID}-vp01`,
      p_lista_attesa: false,
    });
    expect(error, error?.message).toBeFalsy();
    const riga = Array.isArray(data) ? data[0] : data;
    expect(riga?.codice, "la richiesta torna col suo codice leggibile").toBeTruthy();

    // verifica a valle col service role (anon non rilegge nulla, ed è giusto così)
    const { data: p } = await svc
      .from("prenotazioni")
      .select("stato, fonte, codice")
      .eq("id", riga.id)
      .maybeSingle();
    expect(p?.stato).toBe("in_attesa");
    expect(p?.fonte).toBe("qr_vetrina");
  });

  // ══ 4 · funzioni-trigger: nessun endpoint API, trigger ancora attivi ═══════

  it.skipIf(!DB_URL)("nessuna funzione-trigger di public è eseguibile da PUBLIC, anon o authenticated", async () => {
    const righe = await catalogo<{ nome: string; public_exec: boolean; anon_exec: boolean; auth_exec: boolean }>(
      `select p.proname as nome,
              coalesce((
                select bool_or(priv.privilege_type = 'EXECUTE')
                  from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) priv
                 where priv.grantee = 0
              ), false)                                                   as public_exec,
              has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prorettype = 'trigger'::regtype
          and not exists (
            select 1 from pg_depend d
             where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
          )`
    );
    expect(righe.length, "serve almeno una funzione-trigger applicativa da proteggere").toBeGreaterThan(0);
    for (const r of righe) {
      // Fotografia aggiornata alla 023 (12/08): una funzione-trigger non è un endpoint di nessuno. Asserzione per categoria, non per nome: è così che i buchi nascono ed è così che restano chiusi.
      expect(r.public_exec, `PUBLIC non deve eseguire ${r.nome}`).toBe(false);
      expect(r.anon_exec, `anon non deve eseguire ${r.nome}`).toBe(false);
      expect(r.auth_exec, `authenticated non deve eseguire ${r.nome}`).toBe(false);
    }
  });

  it("il trigger `crea_sala_default` scatta comunque: il negozio nato dopo la 020 ha la sua 'Sala 1'", async () => {
    const { data, error } = await svc
      .from("risorse")
      .select("nome, attiva")
      .eq("azienda_id", neg.aziendaId);
    expect(error, error?.message).toBeFalsy();
    expect((data ?? []).length, "ogni azienda nasce con una sala (il NOT NULL dipende da questo)").toBe(1);
    expect((data ?? [])[0]?.nome).toBe("Sala 1");
  });

  it("il trigger `assegna_sala_appuntamento` scatta comunque: l'appuntamento riceve `risorsa_id`", async () => {
    const { data: sale } = await svc.from("risorse").select("id").eq("azienda_id", neg.aziendaId);
    const salaId = (sale ?? [])[0]?.id as string;

    const { data, error } = await svc
      .from("appuntamenti")
      .insert({
        azienda_id: neg.aziendaId,
        utente_id: neg.userId,
        tipo: "controllo_vista",
        inizio: "2099-06-01T09:00:00Z",
        durata_minuti: 30,
        stato: "prenotato",
        fonte: "banco",
        // risorsa_id volutamente NON passata: la mette il trigger.
      })
      .select("risorsa_id")
      .single();
    expect(error, error?.message).toBeFalsy();
    expect(data?.risorsa_id, "senza il trigger il NOT NULL farebbe fallire l'insert").toBe(salaId);
  });

  it("il trigger `assicura_coerenza_tenant` scatta comunque: FK cross-tenant → 23514 (mai 23503)", async () => {
    const r = await svc.from("appuntamenti").insert({
      azienda_id: neg.aziendaId,
      utente_id: neg.userId,
      cliente_id: clienteAltro, // cliente di un ALTRO negozio
      tipo: "controllo_vista",
      inizio: "2099-06-02T09:00:00Z",
      durata_minuti: 30,
      stato: "prenotato",
    });
    expect(r.error, "il trigger di coerenza tenant deve respingere la FK incrociata").toBeTruthy();
    expect(
      r.error?.code,
      "il patto vuole 23514 (check del trigger), mai 23503 (FK): il messaggio dice DI CHI è la riga"
    ).toBe("23514");
  });

  // ══ 5 · policy `risorse` ricreata su authenticated ═════════════════════════

  it("la policy `risorse` ristretta ad authenticated NON ha chiuso fuori il negozio", async () => {
    // Un drop+create sbagliato (predicato diverso, ruolo diverso) lascerebbe il
    // negozio senza sale: silenzioso finché qualcuno non apre l'agenda.
    const mie = await neg.cli.from("risorse").select("id, nome").eq("azienda_id", neg.aziendaId);
    expect(mie.error, mie.error?.message).toBeFalsy();
    expect((mie.data ?? []).length, "il titolare deve vedere la propria Sala 1").toBe(1);

    // e non vede quelle del vicino (stesso predicato di prima della 020)
    const altrui = await neg.cli.from("risorse").select("id").eq("azienda_id", altro.aziendaId);
    expect(altrui.error).toBeFalsy();
    expect((altrui.data ?? []).length, "le sale del vicino restano invisibili").toBe(0);
  });

  it("anon non vede le sale (la policy è per authenticated, e il grant non c'è più)", async () => {
    const r = await anon.from("risorse").select("id").limit(1);
    expect(r.error, "anon non deve interrogare risorse").toBeTruthy();
  });

  // ══ 6 · `_infra_migrazioni` — il registro delle migrazioni ═════════════════

  it("`_infra_migrazioni` contiene la storia 001 → 020 (inclusa `020_bonifica`)", async () => {
    const { data, error } = await svc.from("_infra_migrazioni").select("nome, applied_at");
    expect(error, `il registro deve essere leggibile dal service role: ${error?.message}`).toBeFalsy();

    const nomi = (data ?? []).map((r) => r.nome as string);
    for (const attesa of MIGRAZIONI_ATTESE) {
      expect(nomi, `manca ${attesa} nel registro delle migrazioni`).toContain(attesa);
    }
    expect(nomi, "la 020 deve registrare sé stessa").toContain("020_bonifica");
    expect(nomi.length, "il backfill porta almeno le 20 righe di storia").toBeGreaterThanOrEqual(
      MIGRAZIONI_ATTESE.length
    );

    // Non si fissa il conto ESATTO (le migrazioni future si aggiungono da sé),
    // ma ogni riga deve avere la forma NNN_nome: un refuso qui è un buco nella
    // storia, e la storia è ciò che rende idempotente il riapplico.
    for (const n of nomi) {
      expect(n, `nome di migrazione fuori formato nel registro: ${n}`).toMatch(/^\d{3}_[a-z0-9_]+$/);
    }
    // ogni riga porta il suo timbro
    for (const r of data ?? []) {
      expect(r.applied_at, `applied_at mancante per ${r.nome}`).toBeTruthy();
    }
  });

  it("`_infra_migrazioni` è chiuso ad anon (creato PRIMA del ciclo di revoca)", async () => {
    const r = await anon.from("_infra_migrazioni").select("nome").limit(1);
    expect(r.error, "il registro non è affare del pubblico").toBeTruthy();
    expect((r.data ?? []).length).toBe(0);
  });
});
