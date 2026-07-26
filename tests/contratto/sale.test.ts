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
 * L2 · Contratto — Migrazione 014 (G-014 · LE SALE).
 *
 * La 014 porta `risorsa_id` a prima classe: l'appuntamento è di una SALA, la sala
 * è del negozio. Con UNA sola sala il comportamento è identico alla 013; con DUE
 * si prenota in parallelo. Questo file copre gli scenari PER-SALA che, dopo la
 * 014, non si possono più simulare con UUID inventati (c'è la FK verso `risorse`
 * e il NOT NULL): qui si creano sale VERE nella tabella `risorse` col service role.
 *
 * COME si esercita (stessa filosofia di crea-prenotazione/slot-liberi):
 *  • setup col SERVICE ROLE (portale_attivo/orari/servizio, sale in `risorse`,
 *    appuntamenti «al banco»: non producibili dalla UI pubblica);
 *  • `crea_prenotazione`/`slot_liberi` si chiamano da un client ANON (com'è
 *    esposto al browser: SECURITY DEFINER, grant ad anon);
 *  • le letture di verifica passano dal SERVICE ROLE.
 *
 * Anti-fuso: gli istanti di prova vengono da `slot_liberi` (candidati assoluti già
 * corretti), mai costruiti a mano. Ogni tenant è indipendente → gli istanti non si
 * calpestano fra scenari; dentro un tenant si usano candidati ben distanziati.
 *
 * ⚠️ TEARDOWN (documentato nel report): le prenotazioni sono append-only (trigger
 * no-delete 011) e pinnano il loro appuntamento; gli appuntamenti pinnano la sala
 * (FK `risorsa_id → risorse`, senza on-delete). Ordine di pulizia: prima gli
 * appuntamenti NON collegati a una prenotazione (così le sale si liberano), poi
 * `pulisci()` (che cascata azienda → risorse). Le aziende con una prenotazione (il
 * tenant `uno`) restano per progettazione, come nei giri G7/013. Slug e telefoni
 * unici per RUN_ID → nessuna collisione fra run.
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

/** Telefoni italiani UNICI per RUN_ID (stessa meccanica di crea-prenotazione). */
let telSeq = 0;
function telefonoUnico(): string {
  const seed = Array.from(RUN_ID)
    .map((c) => c.charCodeAt(0) % 10)
    .join("")
    .padEnd(6, "0")
    .slice(0, 6);
  const coda = String(2000 + telSeq++).slice(-4);
  return `3${seed}${coda}`.slice(0, 10);
}

type Sala = { id: string; nome: string; ordine: number; attiva: boolean };

describe.skipIf(!haEnv())("014 · le sale — risorsa_id a prima classe", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let uno: Tenant; // una sola sala (la 'Sala 1' del trigger)
  let due: Tenant; // due sale attive
  let dis: Tenant; // due sale, la seconda disattivata
  let saleDue: Sala[] = [];
  let saleDis: Sala[] = [];
  let candUno: string[] = [];
  let candDue: string[] = [];
  let candDis: string[] = [];

  const K = (etichetta: string) => `test-${RUN_ID}-sale-${etichetta}`;

  async function slot(t: Tenant, servizio: string, giorno: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: t.slug,
      p_servizio: servizio,
      p_giorno: giorno,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  /** Legge (service role, ordinate) le sale di un tenant. */
  async function saleDi(t: Tenant): Promise<Sala[]> {
    const { data, error } = await svc
      .from("risorse")
      .select("id, nome, ordine, attiva")
      .eq("azienda_id", t.aziendaId)
      .order("ordine")
      .order("id");
    if (error) throw new Error(`saleDi: ${error.message}`);
    return (data ?? []) as Sala[];
  }

  /** Semina un appuntamento «al banco» (service role). risorsaId omesso → il
   *  trigger BEFORE INSERT della 014 la assegna. Ritorna {error}. */
  async function seedAppto(t: Tenant, o: {
    inizio: string;
    stato: string;
    risorsaId?: string | null;
    durata?: number;
  }) {
    const riga: Record<string, unknown> = {
      azienda_id: t.aziendaId,
      utente_id: t.userId,
      tipo: "controllo_vista",
      inizio: o.inizio,
      durata_minuti: o.durata ?? 30,
      stato: o.stato,
    };
    if (o.risorsaId !== undefined) riga.risorsa_id = o.risorsaId;
    return svc.from("appuntamenti").insert(riga);
  }

  /** Prepara orari 09–17 tutti i giorni + servizio visita 30' su un tenant. */
  async function pubblicaESemina(t: Tenant) {
    await svc.from("aziende").update({ portale_attivo: true }).eq("id", t.aziendaId);
    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: t.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);
    const eS = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: t.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    uno = await creaTenant("s1uno");
    due = await creaTenant("s1due");
    dis = await creaTenant("s1dis");
    for (const t of [uno, due, dis]) await pubblicaESemina(t);

    // `due`: aggiungo la seconda sala attiva (ordine 2).
    const eDue = await svc
      .from("risorse")
      .insert({ azienda_id: due.aziendaId, nome: "Sala 2", ordine: 2, attiva: true });
    if (eDue.error) throw new Error(`seed Sala 2 (due): ${eDue.error.message}`);
    saleDue = await saleDi(due);
    expect(saleDue.length, "il negozio `due` ha due sale").toBe(2);

    // `dis`: seconda sala DISATTIVATA (ordine 2, attiva=false).
    const eDis = await svc
      .from("risorse")
      .insert({ azienda_id: dis.aziendaId, nome: "Sala 2", ordine: 2, attiva: false });
    if (eDis.error) throw new Error(`seed Sala 2 (dis): ${eDis.error.message}`);
    saleDis = await saleDi(dis);

    const giorno = piuGiorni(oggiRomaISO(), 12);
    candUno = await slot(uno, "visita", giorno);
    candDue = await slot(due, "visita", giorno);
    candDis = await slot(dis, "visita", giorno);
    for (const [c, nome] of [
      [candUno, "uno"],
      [candDue, "due"],
      [candDis, "dis"],
    ] as const) {
      expect(c.length, `il tenant ${nome} ha molti slot liberi`).toBeGreaterThan(24);
    }
  });

  afterAll(async () => {
    if (!haEnv()) return;
    for (const t of [uno, due, dis]) {
      await svc.from("lista_attesa").delete().eq("azienda_id", t.aziendaId);
      // gli appuntamenti collegati a una prenotazione NON si cancellano (pinnano
      // sia la sala sia la pratica append-only): elimino solo i NON collegati, così
      // le sale si liberano e la cascata azienda→risorse può passare dove non ci
      // sono prenotazioni.
      const { data: prens } = await svc
        .from("prenotazioni")
        .select("appuntamento_id")
        .eq("azienda_id", t.aziendaId);
      const collegati = (prens ?? [])
        .map((p) => p.appuntamento_id as string | null)
        .filter((x): x is string => Boolean(x));
      let q = svc.from("appuntamenti").delete().eq("azienda_id", t.aziendaId);
      if (collegati.length) q = q.not("id", "in", `(${collegati.join(",")})`);
      await q;
    }
    await pulisci().catch(() => undefined);
  });

  // ── 1) UNA sala: due appuntamenti sovrapposti → il secondo respinto ─────────
  it("una sola sala: due appuntamenti sovrapposti sullo stesso slot → il secondo è respinto", async () => {
    const sale = await saleDi(uno);
    expect(sale.length, "il negozio nasce con UNA sala").toBe(1);
    expect(sale[0].nome).toBe("Sala 1");

    const inizio = candUno[0];
    const e1 = await seedAppto(uno, { inizio, stato: "prenotato" }); // trigger → Sala 1
    expect(e1.error, "il primo appuntamento entra (sala assegnata dal trigger)").toBeFalsy();

    const e2 = await seedAppto(uno, { inizio, stato: "prenotato" });
    expect(e2.error, "una sala sola: il secondo sullo stesso slot è rifiutato").toBeTruthy();
    expect(
      e2.error!.code === "23P01" || /exclu/i.test(e2.error!.message),
      `atteso exclusion_violation, avuto ${e2.error!.code}: ${e2.error!.message}`
    ).toBe(true);
  });

  // ── 2) DUE sale: due in parallelo ammessi, il terzo respinto ────────────────
  it("due sale: due appuntamenti in parallelo sullo stesso slot → ammessi; il terzo → respinto", async () => {
    const [salaA, salaB] = saleDue;
    const inizio = candDue[0];

    const e1 = await seedAppto(due, { inizio, stato: "prenotato", risorsaId: salaA.id });
    expect(e1.error, "primo appuntamento in Sala 1").toBeFalsy();

    const e2 = await seedAppto(due, { inizio, stato: "prenotato", risorsaId: salaB.id });
    expect(e2.error, "seconda sala in parallelo sullo stesso slot: ammessa").toBeFalsy();

    // terzo sullo stesso slot senza sala → il trigger non trova sale libere e
    // ripiega sulla prima (Sala 1), già occupata → esclusione.
    const e3 = await seedAppto(due, { inizio, stato: "prenotato" });
    expect(e3.error, "entrambe le sale sono occupate: il terzo è rifiutato").toBeTruthy();
    expect(
      e3.error!.code === "23P01" || /exclu/i.test(e3.error!.message),
      `atteso exclusion_violation, avuto ${e3.error!.code}: ${e3.error!.message}`
    ).toBe(true);
  });

  // ── 3) slot_liberi con due sale: offre finché una è libera ──────────────────
  it("slot_liberi con due sale: offre lo slot con UNA occupata, smette quando lo sono ENTRAMBE", async () => {
    const [salaA, salaB] = saleDue;
    const inizio = candDue[8]; // istante fresco, distante da quello del test 2

    const prima = await slot(due, "visita", piuGiorni(oggiRomaISO(), 12));
    expect(prima, "lo slot parte libero").toContain(inizio);

    // occupo SOLO Sala 1: lo slot resta offerto (Sala 2 è libera).
    const e1 = await seedAppto(due, { inizio, stato: "prenotato", risorsaId: salaA.id });
    expect(e1.error).toBeFalsy();
    const conUna = await slot(due, "visita", piuGiorni(oggiRomaISO(), 12));
    expect(conUna, "con una sola sala occupata lo slot è ancora offerto").toContain(inizio);

    // occupo ANCHE Sala 2: ora nessuna sala è libera → lo slot sparisce.
    const e2 = await seedAppto(due, { inizio, stato: "prenotato", risorsaId: salaB.id });
    expect(e2.error).toBeFalsy();
    const conDue = await slot(due, "visita", piuGiorni(oggiRomaISO(), 12));
    expect(conDue, "con entrambe le sale occupate lo slot non è più offerto").not.toContain(inizio);
  });

  // ── 4) una sala disattivata NON conta ───────────────────────────────────────
  it("una sala con attiva=false non conta: occupata l'unica attiva, lo slot sparisce", async () => {
    const attiva = saleDis.find((s) => s.attiva)!;
    const spenta = saleDis.find((s) => !s.attiva)!;
    expect(spenta, "la seconda sala è disattivata").toBeTruthy();

    const inizio = candDis[0];
    const controllo = candDis[8];

    const prima = await slot(dis, "visita", piuGiorni(oggiRomaISO(), 12));
    expect(prima, "lo slot parte libero").toContain(inizio);

    // occupo la sola sala ATTIVA: lo slot sparisce (la disattivata non lo salva).
    const e1 = await seedAppto(dis, { inizio, stato: "prenotato", risorsaId: attiva.id });
    expect(e1.error).toBeFalsy();
    const dopo = await slot(dis, "visita", piuGiorni(oggiRomaISO(), 12));
    expect(
      dopo,
      "occupata l'unica sala attiva, la disattivata non offre lo slot"
    ).not.toContain(inizio);
    // controprova: un altro istante resta libero (la disattivata non toglie nulla).
    expect(dopo, "un istante non occupato resta offerto").toContain(controllo);
  });

  // ── 5) un'azienda nata DOPO la migrazione riceve la sua sala dal trigger ─────
  it("un'azienda creata dopo la 014 riceve la sua 'Sala 1' dal trigger su aziende", async () => {
    const fresco = await creaTenant("s1new");
    const sale = await saleDi(fresco);
    expect(sale.length, "il trigger crea_sala_default ha dato una sala al nuovo negozio").toBe(1);
    expect(sale[0].nome).toBe("Sala 1");
    expect(sale[0].attiva).toBe(true);
    // pulizia diretta: nessun appuntamento/prenotazione → l'azienda si cancella e
    // porta via la sala in cascata.
    await svc.from("aziende").delete().eq("id", fresco.aziendaId);
  });

  // ── 6) sala di un ALTRO negozio → respinta dal trigger di coerenza tenant ────
  it("un appuntamento con una sala di un ALTRO negozio → respinto dal trigger tenant (23514)", async () => {
    const salaEstranea = saleDue[0]; // una sala del negozio `due`
    const inizio = candUno[16];
    // inserisco NEL negozio `uno` puntando a una sala di `due`: coerenza tenant KO.
    const e = await seedAppto(uno, { inizio, stato: "prenotato", risorsaId: salaEstranea.id });
    expect(e.error, "la sala di un altro negozio deve essere rifiutata").toBeTruthy();
    expect(
      e.error!.code === "23514" || /isolamento tenant/i.test(e.error!.message),
      `atteso check_violation 23514, avuto ${e.error!.code}: ${e.error!.message}`
    ).toBe(true);
  });

  // ── 7) crea_prenotazione valida assegna una sala; il secondo slot → SLOT_OCCUPATO ─
  it("crea_prenotazione (una sala) assegna una risorsa_id non nulla; il secondo sullo slot → SLOT_OCCUPATO", async () => {
    const inizio = candUno[8];
    const r1 = await anon.rpc("crea_prenotazione", {
      p_slug: uno.slug,
      p_servizio: "visita",
      p_inizio: inizio,
      p_nome: "Sala Prova",
      p_telefono: telefonoUnico(),
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: "qr_vetrina",
      p_chiave_richiesta: K("valida-a"),
      p_lista_attesa: false,
    });
    expect(r1.error, r1.error?.message).toBeFalsy();
    const riga = (Array.isArray(r1.data) ? r1.data[0] : r1.data)!;

    // l'appuntamento collegato ha una sala assegnata (non nulla).
    const { data: pren, error: eP } = await svc
      .from("prenotazioni")
      .select("appuntamento_id")
      .eq("id", riga.id)
      .single();
    expect(eP, eP?.message).toBeFalsy();
    const { data: appto, error: eA } = await svc
      .from("appuntamenti")
      .select("risorsa_id")
      .eq("id", pren!.appuntamento_id)
      .single();
    expect(eA, eA?.message).toBeFalsy();
    expect(appto!.risorsa_id, "crea_prenotazione assegna una sala attiva").toBeTruthy();

    // seconda richiesta sullo stesso slot con l'unica sala → SLOT_OCCUPATO.
    const r2 = await anon.rpc("crea_prenotazione", {
      p_slug: uno.slug,
      p_servizio: "visita",
      p_inizio: inizio,
      p_nome: "Sala Prova 2",
      p_telefono: telefonoUnico(),
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: "qr_vetrina",
      p_chiave_richiesta: K("valida-b"),
      p_lista_attesa: false,
    });
    expect(r2.error, "l'unica sala è già presa: la seconda richiesta è SLOT_OCCUPATO").toBeTruthy();
    expect(r2.error!.message).toContain("SLOT_OCCUPATO");
  });
});
