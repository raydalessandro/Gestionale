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
 * L2 · Contratto — Migrazione 018 (G8 · «Prendi come cliente»): l'ultimo passo del
 * giro «le richieste dentro l'agenda». L'ottico ACCETTA una richiesta dal portale
 * (transizioni di stato dentro il tenant, via RLS) e poi, come ATTO SEPARATO, può
 * prendersi la persona come cliente attraverso la funzione security-definer
 * `prendi_persona_come_cliente` — l'UNICO percorso di scrittura verso `persone` e
 * `persone_riferimento_registro` (RLS attiva SENZA policy: ID-01 della 011).
 *
 * COME si esercita:
 *  • setup col SERVICE ROLE (portale_attivo/orari/servizio non producibili dalla UI);
 *  • la RICHIESTA nasce da `crea_prenotazione` invocata come ANON (è così che la
 *    tocca il portale): crea in una transazione l'appuntamento `in_attesa` + la
 *    prenotazione `in_attesa` collegata + la `persona`;
 *  • ACCETTA / RIFIUTA sono le transizioni della UI dell'agenda (server actions),
 *    qui replicate 1:1 con il client AUTENTICATO del titolare (aggiornamenti
 *    condizionati su `.eq("stato","in_attesa")`): esercitano la RLS del tenant;
 *  • `prendi_persona_come_cliente` / `cliente_per_telefono` si invocano dal client
 *    AUTENTICATO (grant `authenticated`); usano `auth.uid()`/`get_azienda_id()`;
 *  • la VERIFICA di `persone` e `persone_riferimento_registro` passa dal SERVICE
 *    ROLE: quelle due tabelle sono chiuse a ogni client (nessuna policy).
 *
 * Anti-fuso: nessun timestamp costruito a mano. Ogni richiesta prende il suo slot
 * da `slot_liberi` su un GIORNO futuro dedicato (offset crescente): slot sempre
 * freschi, zero contesa fra sotto-test.
 *
 * ⚠️ RESIDUO APPEND-ONLY (come g7/crea-prenotazione): la prenotazione non è
 * cancellabile (trigger no-delete 011), pinna persona + appuntamento; il «prendi»
 * scrive anche clienti + registro e imposta l'ottico della persona. Il teardown è
 * best-effort; i dati restano sul progetto di test. Mitigazione: slug/telefoni
 * unici per RUN_ID (vedi report-test.md).
 */

const TZ = "Europe/Rome";

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
 * Telefoni italiani UNICI per RUN_ID — ESATTAMENTE 10 cifre, coda INTERA.
 * Bug storico evitato: `3 + seed(6) + coda(4)` = 11 cifre poi tagliate a 10
 * perdevano l'ultima cifra della coda → due contatori diversi collassavano sullo
 * stesso numero. Qui: `3` + 3 cifre stabili dal run + 6 cifre di contatore = 10,
 * il contatore non viene mai troncato.
 */
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

describe.skipIf(!haEnv())("018 · prendi_persona_come_cliente — accetta e prendi (G8)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let neg: Tenant; // il negozio che riceve le richieste
  let altra: Tenant; // un altro negozio, per isolamento e cross-tenant
  let dayCounter = 5; // offset del giorno per la prossima richiesta (slot freschi)

  const K = (etichetta: string) => `test-${RUN_ID}-g8-${etichetta}`;

  async function slot(g: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_giorno: g,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  /** Legge la prenotazione dal SERVICE ROLE (anon/altri client non la vedono). */
  async function leggiPren(id: string) {
    const { data, error } = await svc.from("prenotazioni").select("*").eq("id", id).single();
    if (error) throw new Error(`leggiPren: ${error.message}`);
    return data;
  }
  async function leggiAppto(id: string) {
    const { data, error } = await svc.from("appuntamenti").select("*").eq("id", id).single();
    if (error) throw new Error(`leggiAppto: ${error.message}`);
    return data;
  }

  type Richiesta = {
    prenId: string;
    apptId: string;
    personaId: string;
    inizio: string;
    giorno: string;
    telefono: string;
    fonte: string;
  };

  /** Crea una RICHIESTA (in_attesa) dal portale, su un giorno futuro dedicato. */
  async function nuovaRichiesta(
    o: { telefono?: string; nome?: string; fonte?: string } = {}
  ): Promise<Richiesta> {
    const giorno = piuGiorni(oggiRomaISO(), dayCounter++);
    const slots = await slot(giorno);
    expect(slots.length, `il giorno ${giorno} deve avere slot liberi`).toBeGreaterThan(0);
    const inizio = slots[0];
    const telefono = o.telefono ?? telefonoUnico();
    const fonte = o.fonte ?? "qr_vetrina";
    const { data, error } = await anon.rpc("crea_prenotazione", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_inizio: inizio,
      p_nome: o.nome ?? "Anna Verdi",
      p_telefono: telefono,
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: fonte,
      p_chiave_richiesta: K(`req-${telefono}-${inizio}`),
      p_lista_attesa: false,
    });
    if (error) throw new Error(`crea_prenotazione: ${error.message}`);
    const riga = (Array.isArray(data) ? data[0] : data)!;
    const p = await leggiPren(riga.id);
    return {
      prenId: p.id,
      apptId: p.appuntamento_id,
      personaId: p.persona_id,
      inizio,
      giorno,
      telefono,
      fonte,
    };
  }

  /** Replica la server action `accettaRichiesta` col client del titolare (RLS). */
  async function accetta(r: Richiesta) {
    const u1 = await neg.cli
      .from("appuntamenti")
      .update({ stato: "prenotato" })
      .eq("id", r.apptId)
      .eq("stato", "in_attesa")
      .select("id");
    if (u1.error) throw new Error(`accetta appuntamento: ${u1.error.message}`);
    const u2 = await neg.cli
      .from("prenotazioni")
      .update({ stato: "accettata" })
      .eq("appuntamento_id", r.apptId)
      .eq("stato", "in_attesa")
      .select("id");
    if (u2.error) throw new Error(`accetta prenotazione: ${u2.error.message}`);
    return { apptRows: u1.data?.length ?? 0, prenRows: u2.data?.length ?? 0 };
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    neg = await creaTenant("g8");
    altra = await creaTenant("g8b");
    await svc
      .from("aziende")
      .update({ portale_attivo: true, nome_pubblico: `Ottica G8 ${RUN_ID}` })
      .eq("id", neg.aziendaId);

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
  });

  afterAll(async () => {
    if (!haEnv()) return;
    // Best-effort: gli appuntamenti NON collegati a una prenotazione sono
    // cancellabili; il resto (prenotazioni/persone/clienti/registro/azienda) resta
    // append-only o pinnato (vedi nota in testa e report-test.md).
    for (const az of [neg?.aziendaId, altra?.aziendaId].filter(Boolean) as string[]) {
      await svc.from("lista_attesa").delete().eq("azienda_id", az);
      const { data: prens } = await svc
        .from("prenotazioni")
        .select("appuntamento_id")
        .eq("azienda_id", az);
      const collegati = (prens ?? [])
        .map((p) => p.appuntamento_id as string | null)
        .filter((x): x is string => Boolean(x));
      let q = svc.from("appuntamenti").delete().eq("azienda_id", az);
      if (collegati.length) q = q.not("id", "in", `(${collegati.join(",")})`);
      await q;
    }
    await pulisci().catch(() => undefined);
  });

  // 1 ── Accetta: appuntamento → prenotato, prenotazione → accettata ────────────
  it("Accetta: appuntamento in_attesa→prenotato e prenotazione in_attesa→accettata", async () => {
    const r = await nuovaRichiesta();
    // stato di partenza: entrambe in_attesa
    expect((await leggiAppto(r.apptId)).stato).toBe("in_attesa");
    expect((await leggiPren(r.prenId)).stato).toBe("in_attesa");

    const res = await accetta(r);
    expect(res.apptRows, "l'update tocca l'appuntamento").toBe(1);
    expect(res.prenRows, "l'update tocca la prenotazione").toBe(1);

    expect((await leggiAppto(r.apptId)).stato).toBe("prenotato");
    expect((await leggiPren(r.prenId)).stato).toBe("accettata");
  });

  // 2 ── Rifiuta: annullato + rifiutata, e lo SLOT ricompare in slot_liberi ─────
  it("Rifiuta: appuntamento→annullato, prenotazione→rifiutata, e lo slot torna in slot_liberi", async () => {
    const r = await nuovaRichiesta();

    // prima del rifiuto lo slot è occupato dall'appuntamento in_attesa
    const prima = await slot(r.giorno);
    expect(prima, "lo slot della richiesta NON è offerto (occupato in_attesa)").not.toContain(r.inizio);

    // rifiuta (replica di rifiutaRichiesta, con motivo → nota)
    const u1 = await neg.cli
      .from("appuntamenti")
      .update({ stato: "annullato", note: "— Rifiutata: prova contratto" })
      .eq("id", r.apptId)
      .eq("stato", "in_attesa")
      .select("id");
    expect(u1.error, u1.error?.message).toBeFalsy();
    expect(u1.data?.length).toBe(1);
    const u2 = await neg.cli
      .from("prenotazioni")
      .update({ stato: "rifiutata" })
      .eq("appuntamento_id", r.apptId)
      .eq("stato", "in_attesa")
      .select("id");
    expect(u2.error, u2.error?.message).toBeFalsy();

    expect((await leggiAppto(r.apptId)).stato).toBe("annullato");
    expect((await leggiPren(r.prenId)).stato).toBe("rifiutata");

    // §5: l'EXCLUDE non conta gli annullati → lo slot RICOMPARE libero
    const dopo = await slot(r.giorno);
    expect(dopo, "rifiutata la richiesta, lo slot torna prenotabile").toContain(r.inizio);
  });

  // 3 ── Accetta due volte: la seconda non cambia nulla (idempotenza sul dato) ──
  it("Accetta due volte: il secondo update condizionato tocca 0 righe (stato invariato)", async () => {
    const r = await nuovaRichiesta();

    const primo = await neg.cli
      .from("appuntamenti")
      .update({ stato: "prenotato" })
      .eq("id", r.apptId)
      .eq("stato", "in_attesa")
      .select("id");
    expect(primo.data?.length, "il primo Accetta cambia lo stato").toBe(1);

    const secondo = await neg.cli
      .from("appuntamenti")
      .update({ stato: "prenotato" })
      .eq("id", r.apptId)
      .eq("stato", "in_attesa") // ora non matcha più: è già prenotato
      .select("id");
    expect(secondo.data?.length, "il secondo Accetta non trova più righe in_attesa").toBe(0);

    expect((await leggiAppto(r.apptId)).stato, "resta prenotato, nessun doppio effetto").toBe("prenotato");
  });

  // 4 ── prendi con p_cliente_id (telefono già proprio) → COLLEGA, non duplica ──
  it("prendi_persona_come_cliente con p_cliente_id: collega l'esistente, conteggio clienti invariato", async () => {
    const tel = telefonoUnico();
    const esistente = await creaCliente(neg, {
      nome: "Giulia",
      cognome: `Esistente ${RUN_ID}`,
      telefono: tel,
    });

    const r = await nuovaRichiesta({ telefono: tel });
    await accetta(r);

    const prima = await neg.cli
      .from("clienti")
      .select("id", { count: "exact", head: true })
      .eq("azienda_id", neg.aziendaId);
    const contoPrima = prima.count ?? 0;

    const { data, error } = await neg.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: r.prenId,
      p_cliente_id: esistente,
    });
    expect(error, error?.message).toBeFalsy();
    expect(data, "ritorna il cliente collegato").toBe(esistente);

    const dopo = await neg.cli
      .from("clienti")
      .select("id", { count: "exact", head: true })
      .eq("azienda_id", neg.aziendaId);
    expect(dopo.count ?? 0, "nessun doppione: il conteggio clienti non cambia").toBe(contoPrima);

    // la prenotazione punta al cliente esistente
    expect((await leggiPren(r.prenId)).cliente_id).toBe(esistente);
    expect((await leggiAppto(r.apptId)).cliente_id).toBe(esistente);
  });

  // 5 ── prendi con p_cliente_id null (telefono nuovo) → CREA, senza marketing ──
  it("prendi_persona_come_cliente senza p_cliente_id: crea il cliente (consenso_marketing=false, fonte dalla prenotazione)", async () => {
    const r = await nuovaRichiesta({ nome: "Marco Neri", fonte: "qr_vetrina" });
    await accetta(r);

    const { data, error } = await neg.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: r.prenId,
      p_cliente_id: null,
    });
    expect(error, error?.message).toBeFalsy();
    const nuovoId = data as string;
    expect(nuovoId, "ritorna l'id del cliente creato").toBeTruthy();

    const { data: cli, error: eCli } = await neg.cli
      .from("clienti")
      .select("nome, cognome, telefono, fonte, consenso_marketing")
      .eq("id", nuovoId)
      .single();
    expect(eCli, eCli?.message).toBeFalsy();
    expect(cli!.consenso_marketing, "nessun consenso commerciale automatico").toBe(false);
    expect(cli!.fonte, "la fonte del canale attraversa fino al cliente").toBe(r.fonte);
    expect(cli!.telefono).toBe(r.telefono);
    // nome unico «Marco Neri» → primo token nome, resto cognome
    expect(cli!.nome).toBe("Marco");
    expect(cli!.cognome).toBe("Neri");
  });

  // 6 ── dopo: persone.ottico_di_riferimento + UNA riga di registro (service) ───
  it("dopo il prendi: persone.ottico_di_riferimento valorizzato e UNA sola riga di registro", async () => {
    const r = await nuovaRichiesta();
    await accetta(r);

    const { error } = await neg.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: r.prenId,
      p_cliente_id: null,
    });
    expect(error, error?.message).toBeFalsy();

    // persone è chiusa a ogni client: si verifica col SERVICE ROLE
    const { data: persona, error: eP } = await svc
      .from("persone")
      .select("ottico_di_riferimento")
      .eq("id", r.personaId)
      .single();
    expect(eP, eP?.message).toBeFalsy();
    expect(persona!.ottico_di_riferimento, "l'ottico di riferimento diventa il negozio").toBe(
      neg.aziendaId
    );

    const { data: reg, error: eR } = await svc
      .from("persone_riferimento_registro")
      .select("persona_id, a_azienda_id, prenotazione_id, utente_id")
      .eq("prenotazione_id", r.prenId);
    expect(eR, eR?.message).toBeFalsy();
    expect(reg?.length, "una sola riga di registro per il passaggio").toBe(1);
    expect(reg![0].a_azienda_id).toBe(neg.aziendaId);
    expect(reg![0].persona_id).toBe(r.personaId);
    expect(reg![0].utente_id, "traccia CHI ha premuto").toBe(neg.userId);

    // idempotenza: un secondo prendi non scrive una seconda riga di registro
    const { data: due, error: eDue } = await neg.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: r.prenId,
      p_cliente_id: null,
    });
    expect(eDue, eDue?.message).toBeFalsy();
    expect(due, "ritorna lo stesso cliente già collegato").toBe(
      (await leggiPren(r.prenId)).cliente_id
    );
    const { data: reg2 } = await svc
      .from("persone_riferimento_registro")
      .select("persona_id")
      .eq("prenotazione_id", r.prenId);
    expect(reg2?.length, "il secondo prendi NON aggiunge una riga").toBe(1);
  });

  // 7 ── respinto: NON_ACCETTATA (richiesta non accettata) e NON_TUA (cross-tenant)
  it("prendi respinto: NON_ACCETTATA se la richiesta non è accettata, NON_TUA da un altro negozio", async () => {
    // a) richiesta ancora in_attesa (mai accettata) → NON_ACCETTATA
    const inAttesa = await nuovaRichiesta();
    const a = await neg.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: inAttesa.prenId,
      p_cliente_id: null,
    });
    expect(a.error?.message, "serve prima accettare").toContain("NON_ACCETTATA");

    // b) richiesta di NEG accettata, ma chiamata da ALTRA → NON_TUA
    const mia = await nuovaRichiesta();
    await accetta(mia);
    const b = await altra.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: mia.prenId,
      p_cliente_id: null,
    });
    expect(b.error?.message, "un altro negozio non può prendere la mia richiesta").toContain(
      "NON_TUA"
    );
    // e non ha lasciato tracce: la prenotazione resta senza cliente
    expect((await leggiPren(mia.prenId)).cliente_id).toBeNull();
  });

  // 8 ── isolamento: un altro negozio non vede né la prenotazione né la persona ─
  it("isolamento: un altro negozio non vede la prenotazione (RLS) né la persona (tabella chiusa)", async () => {
    const r = await nuovaRichiesta();

    // il titolare del negozio VEDE la propria prenotazione (controprova)
    const propria = await neg.cli.from("prenotazioni").select("id").eq("id", r.prenId);
    expect(propria.error, propria.error?.message).toBeFalsy();
    expect(propria.data?.length, "il negozio vede la propria richiesta").toBe(1);

    // l'altro negozio NON la vede (RLS di tenant)
    const estranea = await altra.cli.from("prenotazioni").select("id").eq("id", r.prenId);
    expect(estranea.error, estranea.error?.message).toBeFalsy();
    expect(estranea.data?.length, "un altro negozio non vede la richiesta").toBe(0);

    // `persone` è chiusa a OGNI client (nessuna policy): nemmeno il proprio negozio
    const personaAltra = await altra.cli.from("persone").select("id").eq("id", r.personaId);
    expect(personaAltra.data?.length ?? 0, "persone è invisibile agli altri").toBe(0);
    const personaNeg = await neg.cli.from("persone").select("id").eq("id", r.personaId);
    expect(personaNeg.data?.length ?? 0, "persone è chiusa anche al proprio negozio (solo definer)").toBe(0);
  });

  // 9 ── cliente_per_telefono: trova il PROPRIO, non quello di un altro tenant ──
  it("cliente_per_telefono: ognuno trova il proprio, mai quello di un altro negozio", async () => {
    const tel = telefonoUnico();
    const negCli = await creaCliente(neg, { nome: "Sara", cognome: `Neg ${RUN_ID}`, telefono: tel });
    const altraCli = await creaCliente(altra, {
      nome: "Sara",
      cognome: `Altra ${RUN_ID}`,
      telefono: tel,
    });

    const miaRicerca = await neg.cli.rpc("cliente_per_telefono", { p_telefono: tel });
    expect(miaRicerca.error, miaRicerca.error?.message).toBeFalsy();
    const mio = (Array.isArray(miaRicerca.data) ? miaRicerca.data[0] : miaRicerca.data) as
      | { id: string }
      | undefined;
    expect(mio?.id, "il negozio trova il PROPRIO cliente").toBe(negCli);

    const suaRicerca = await altra.cli.rpc("cliente_per_telefono", { p_telefono: tel });
    const suo = (Array.isArray(suaRicerca.data) ? suaRicerca.data[0] : suaRicerca.data) as
      | { id: string }
      | undefined;
    expect(suo?.id, "l'altro negozio trova IL SUO, mai quello del vicino").toBe(altraCli);
    expect(suo?.id).not.toBe(negCli);
  });
});
