import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  creaCliente,
  creaUtente,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — **C1 · anonimizzazione** (`anonimizza_cliente`, migrazione 021).
 *
 * Il principio, in una riga: **i FATTI aziendali restano integri e leggibili;
 * sparisce la RICONOSCIBILITÀ della persona.** Quindi il test non si accontenta
 * di «il nome è cambiato»: verifica CAMPO PER CAMPO la mappa di C1 (che cosa va
 * a NULL, che cosa diventa una costante, che cosa RESTA) e poi va a rileggere
 * vendite e ordini per accertarsi che i numeri e gli importi siano ancora lì.
 *
 * Il cliente di prova nasce con OGNI campo personale valorizzato: un campo
 * lasciato vuoto passerebbe il test anche se la funzione lo dimenticasse.
 *
 * ⚠️ Teardown best-effort: le prenotazioni non sono cancellabili (trigger
 * no-delete della 011) e pinnano persona + appuntamento. `pulisci()` toglie le
 * aziende; il residuo di `persone` resta sul progetto di test (telefoni unici
 * per RUN_ID, vedi report-test.md).
 */

/** Telefoni italiani unici per RUN_ID: 1 + 3 (dal run) + 6 (contatore) = 10 cifre. */
let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): string {
  // Il DB di test PERSISTE tra i run e la vecchia base (RUN_ID %10, 3 cifre)
  // poteva collassare uguale tra run diversi: col telSeq che riparte da 0, il
  // primo numero del run N collideva col residuo del run N-1 sull'indice dei
  // telefoni veri (visto in CI #124). Base = ms di avvio: unica tra i run.
  return `3${TEL_BASE}${String(telSeq++).padStart(4, "0")}`;
}

describe.skipIf(!haEnv())("021 · C1 · anonimizzazione (la mappa, campo per campo)", () => {
  let A: Tenant;
  let svc: SupabaseClient;
  let assicurazioneNessuna: string;

  /** I campi personali del cliente, tutti valorizzati: la mappa di C1 al completo. */
  const PERSONALI = {
    nome: "Laura",
    secondo_nome: "Maria",
    cognome: `Bianchi ${RUN_ID}`,
    codice_fiscale: "BNCLRA85M50F205Z",
    data_nascita: "1985-08-10",
    sesso: "F",
    email: `laura.${RUN_ID}@esempio.it`,
    telefono: "+39 333 1234567",
    telefono_casa: "02 1234567",
    telefono_lavoro: "02 7654321",
    indirizzo: "Via Roma 12",
    indirizzo2: "Scala B, interno 4",
    cap: "20100",
    citta: "Milano",
    provincia: "MI",
    nazione: "Italia",
    note: "Preferisce il pomeriggio; sensibile alla luce.",
    dati_fatturazione: { ragione_sociale: "Bianchi SRL", sdi: "ABCDEFG", cf_azienda: "12345678901" },
    canale_preferito: "email",
    tutore_legale: "Giuseppe Bianchi",
    lingua: "Italiano",
    tags: ["vip", "presbite"],
    non_contattare: false,
    fonte: "convenzione",
  };

  async function numero(t: Tenant, prefisso: "BL" | "OL" | "VE"): Promise<string> {
    const { data, error } = await t.cli.rpc("prossimo_numero", { p_prefisso: prefisso });
    expect(error, `prossimo_numero ${prefisso}`).toBeNull();
    return data as string;
  }

  /** Slot futuri distinti: l'EXCLUDE di `appuntamenti` non tollera sovrapposizioni. */
  let slotSeq = 0;
  function slotFuturo(): string {
    const d = new Date(Date.UTC(2099, 0, 1, 9, 0, 0));
    d.setUTCDate(d.getUTCDate() + slotSeq++);
    return d.toISOString();
  }

  /**
   * Un appuntamento di un tenant qualunque, col service role.
   *
   * ⚠️ `prenotazioni.appuntamento_id` è **NOT NULL dalla 013** («l'agenda unica»:
   * la verità dello slot è l'appuntamento). Una prenotazione seminata senza
   * appuntamento non entra — dà 23502, e il test muore nel setup con un
   * messaggio che parla di colonne, non di contratto. `risorsa_id` invece si
   * omette apposta: lo riempie il trigger `assegna_sala_appuntamento` (014).
   */
  async function appuntamentoDi(
    aziendaId: string,
    inizio: string,
    clienteId: string | null = null
  ): Promise<string> {
    const { data, error } = await svc
      .from("appuntamenti")
      .insert({
        azienda_id: aziendaId,
        cliente_id: clienteId,
        tipo: "controllo_vista",
        inizio,
        durata_minuti: 30,
        stato: "prenotato",
        note: "portata dal portale",
      })
      .select("id")
      .single();
    if (error) throw new Error(`appuntamento: ${error.message}`);
    return data!.id as string;
  }

  /** Una persona di portale nuova (identità di PIATTAFORMA: nessun azienda_id). */
  async function personaNuova(nome = "Laura Bianchi"): Promise<{ id: string; tel: string }> {
    const tel = telefonoUnico();
    const { data, error } = await svc
      .from("persone")
      .insert({ telefono_grezzo: tel, nome, email: `p.${tel}@esempio.it` })
      .select("id")
      .single();
    if (error) throw new Error(`persona: ${error.message}`);
    return { id: data!.id as string, tel };
  }

  /** Una prenotazione di `aziendaId` per `persona`, eventualmente già presa come cliente. */
  async function prenotazioneDi(o: {
    aziendaId: string;
    persona: string;
    tel: string;
    clienteId?: string | null;
    nome?: string;
    perContoDi?: string | null;
    /** false = l'appuntamento NON punta al cliente (serve a poterlo cancellare). */
    appuntamentoDelCliente?: boolean;
  }): Promise<string> {
    const inizio = slotFuturo();
    const appuntamento = await appuntamentoDi(
      o.aziendaId,
      inizio,
      o.appuntamentoDelCliente === false ? null : o.clienteId ?? null
    );
    const nome = o.nome ?? "Laura Bianchi";
    const { data, error } = await svc
      .from("prenotazioni")
      .insert({
        azienda_id: o.aziendaId,
        persona_id: o.persona,
        cliente_id: o.clienteId ?? null,
        appuntamento_id: appuntamento,
        servizio_codice: "visita",
        inizio,
        durata_minuti: 30,
        stato: "accettata",
        contatto_nome: nome,
        contatto_telefono: o.tel,
        contatto_email: `p.${o.tel}@esempio.it`,
        per_conto_di: o.perContoDi ?? null,
        note: "chiamare dopo le 15",
      })
      .select("id")
      .single();
    if (error) throw new Error(`prenotazione: ${error.message}`);
    return data!.id as string;
  }

  /** Crea una persona di portale + la sua prenotazione agganciata al cliente. */
  async function personaCollegata(clienteId: string): Promise<string> {
    const p = await personaNuova();
    await prenotazioneDi({
      aziendaId: A.aziendaId,
      persona: p.id,
      tel: p.tel,
      clienteId,
    });
    return p.id;
  }

  beforeAll(async () => {
    A = await creaTenant("c1");
    svc = serviceClient();
    const { data } = await A.cli
      .from("assicurazioni")
      .select("id")
      .eq("nome", "NESSUNA")
      .single();
    assicurazioneNessuna = data!.id as string;
  });
  afterAll(pulisci);

  /* ══ 1 · La mappa completa, su un cliente con tutto il contorno ═════════ */

  it("C1 · la mappa campo per campo + i fatti che restano leggibili", async () => {
    // ── il contorno: un ente convenzionato e un parente ────────────────────
    const ente = await creaCliente(A, { nome: "Azienda", cognome: `Convenzionata ${RUN_ID}` });
    const parente = await creaCliente(A, { nome: "Marco", cognome: `Bianchi ${RUN_ID}` });

    const cliente = await creaCliente(A, {
      ...PERSONALI,
      assicurazione_id: assicurazioneNessuna,
      azienda_convenzionata_id: ente,
    });

    // ── prescrizione (dato clinico: si conserva, le note no) ──────────────
    const { data: rx } = await A.cli
      .from("prescrizioni")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: cliente,
        tipo: "occhiali",
        od_sfero: -2.25,
        os_sfero: -2.0,
        note: "la signora Bianchi porta le lenti di sua sorella",
      })
      .select("id")
      .single();

    // ── consensi: uno marketing (dall'azione) e uno sanitario con documento ─
    await A.cli.rpc("registra_consenso", {
      p_cliente_id: cliente,
      p_tipo: "marketing",
      p_azione: "dato",
      p_canali: ["email", "cellulare"],
      p_modalita: "penna",
      p_prescrizione_id: null,
      p_versione: "v2",
      p_documento_ref: null,
    });
    await A.cli.from("consensi").insert({
      azienda_id: A.aziendaId,
      cliente_id: cliente,
      tipo: "dati_sanitari",
      azione: "dato",
      prescrizione_id: rx!.id,
      modalita: "penna",
      documento_ref: "11111111-2222-3333-4444-555555555555",
    });

    // ── relazione (de-anonimizza per prossimità: sparisce) ────────────────
    const { error: eRel } = await A.cli.rpc("crea_relazione", {
      p_cliente_id: cliente,
      p_relativo_id: parente,
      p_tipo: "fratello",
      p_note: null,
    });
    expect(eRel).toBeNull();

    // ── i FATTI: una busta, un ordine LAC, una vendita ────────────────────
    const numBusta = await numero(A, "BL");
    const { data: busta, error: eBusta } = await A.cli
      .from("ordini_occhiali")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: cliente,
        numero: numBusta,
        stato: "consegnata",
        totale: 965,
        acconto: 780,
        note: "consegnare alla figlia Anna",
      })
      .select("id")
      .single();
    expect(eBusta).toBeNull();

    const numLac = await numero(A, "OL");
    const { error: eLac } = await A.cli.from("ordini_lac").insert({
      azienda_id: A.aziendaId,
      cliente_id: cliente,
      numero: numLac,
      stato: "consegnato",
      totale: 120,
      note: "il marito passa a ritirare",
    });
    expect(eLac).toBeNull();

    const numVendita = await numero(A, "VE");
    const { error: eVen } = await A.cli.from("vendite").insert({
      azienda_id: A.aziendaId,
      cliente_id: cliente,
      numero: numVendita,
      totale: 965,
      iva_totale: 174,
      doc_numero: "1405-0006",
      doc_data: "2026-08-01",
      cf_cliente: PERSONALI.codice_fiscale,
      busta_id: busta!.id,
    });
    expect(eVen).toBeNull();

    // ── agenda e richiami (note libere: via) ──────────────────────────────
    await A.cli.from("richiami").insert({
      azienda_id: A.aziendaId,
      cliente_id: cliente,
      tipo: "controllo_vista",
      note: "chiedere della madre",
    });

    /* ── L'ATTO ─────────────────────────────────────────────────────────── */
    const { error: eAnon } = await A.cli.rpc("anonimizza_cliente", { p_cliente_id: cliente });
    expect(eAnon, "l'anonimizzazione deve riuscire in una sola transazione").toBeNull();

    /* ── (a) `clienti`: la mappa C1 campo per campo ─────────────────────── */
    const { data: dopo, error: eDopo } = await A.cli
      .from("clienti")
      .select("*")
      .eq("id", cliente)
      .single();
    expect(eDopo, "il cliente anonimo resta LEGGIBILE (non si cancella)").toBeNull();

    // costanti
    expect(dopo!.nome, "nome → 'Cliente'").toBe("Cliente");
    expect(dopo!.cognome, "cognome → 'Anonimizzato-' + primi 8 dell'id").toBe(
      `Anonimizzato-${cliente.slice(0, 8)}`
    );

    // tutto ciò che identifica → NULL
    const AZZERATI = [
      "secondo_nome",
      "codice_fiscale",
      "data_nascita",
      "sesso",
      "email",
      "telefono",
      "telefono_casa",
      "telefono_lavoro",
      "indirizzo",
      "indirizzo2",
      "cap",
      "citta",
      "provincia",
      "nazione",
      "note",
      "dati_fatturazione",
      "canale_preferito",
      "assicurazione_id",
      "azienda_convenzionata_id",
      "tutore_legale",
      "lingua",
      "consenso_canali",
      "data_consenso",
      "consenso_dati_sanitari",
      "consenso_sanitario_il",
    ] as const;
    const rimasti = AZZERATI.filter((c) => (dopo as Record<string, unknown>)[c] !== null);
    expect(rimasti, `campi personali NON azzerati: ${rimasti.join(", ")}`).toEqual([]);

    // le altre trasformazioni della mappa
    expect(dopo!.tags, "tags → vuoto").toEqual([]);
    expect(dopo!.non_contattare, "i flag operativi si spengono in senso RESTRITTIVO").toBe(true);
    expect(dopo!.consenso_marketing, "cache consensi spenta").toBe(false);
    expect(dopo!.anonimizzato_il, "anonimizzato_il → now()").not.toBeNull();

    // ciò che RESTA per contratto
    expect(dopo!.fonte, "fonte RESTA: statistica aziendale, non identifica").toBe(
      PERSONALI.fonte
    );
    expect(dopo!.azienda_id, "il cliente resta del suo negozio").toBe(A.aziendaId);
    expect(dopo!.created_at, "i timestamp di sistema restano").not.toBeNull();

    /* ── (b) `consensi`: le righe si conservano, documento_ref → NULL ───── */
    const { data: cons } = await A.cli
      .from("consensi")
      .select("id, tipo, azione, documento_ref")
      .eq("cliente_id", cliente);
    expect(cons!.length, "i fatti storici del mastro si CONSERVANO").toBe(2);
    expect(
      cons!.filter((c) => c.documento_ref !== null),
      "documento_ref → NULL su ogni riga"
    ).toEqual([]);

    /* ── (c) `clienti_relazioni`: sparite ───────────────────────────────── */
    const { data: rel } = await A.cli
      .from("clienti_relazioni")
      .select("id")
      .or(`cliente_id.eq.${cliente},relativo_id.eq.${cliente}`);
    expect(rel ?? [], "la relazione de-anonimizza per prossimità: si cancella").toEqual([]);

    /* ── (d) clinico e agenda: si conservano, i testi liberi no ─────────── */
    const { data: rxDopo } = await A.cli
      .from("prescrizioni")
      .select("id, od_sfero, note")
      .eq("cliente_id", cliente)
      .single();
    expect(rxDopo, "la prescrizione SI CONSERVA agganciata all'id anonimo").toBeTruthy();
    expect(Number(rxDopo!.od_sfero), "il dato clinico resta").toBe(-2.25);
    expect(rxDopo!.note, "le note possono contenere riferimenti personali → NULL").toBeNull();

    const { data: richiami } = await A.cli
      .from("richiami")
      .select("id, note")
      .eq("cliente_id", cliente);
    expect(richiami!.length).toBe(1);
    expect(richiami![0].note).toBeNull();

    /* ── (e) i FATTI: ordini e vendite ancora leggibili, con numeri e importi ── */
    const { data: bustaDopo } = await A.cli
      .from("ordini_occhiali")
      .select("numero, totale, acconto, saldo, stato, note")
      .eq("id", busta!.id)
      .single();
    expect(bustaDopo!.numero, "il numero della busta resta").toBe(numBusta);
    expect(Number(bustaDopo!.totale), "gli importi restano").toBe(965);
    expect(Number(bustaDopo!.acconto)).toBe(780);
    expect(Number(bustaDopo!.saldo)).toBe(185);
    expect(bustaDopo!.stato).toBe("consegnata");
    expect(bustaDopo!.note, "le note dell'ordine → NULL").toBeNull();

    const { data: lacDopo } = await A.cli
      .from("ordini_lac")
      .select("numero, totale, note")
      .eq("numero", numLac)
      .single();
    expect(lacDopo!.numero).toBe(numLac);
    expect(Number(lacDopo!.totale)).toBe(120);
    expect(lacDopo!.note).toBeNull();

    const { data: venDopo } = await A.cli
      .from("vendite")
      .select("numero, totale, iva_totale, doc_numero, doc_data, cf_cliente, stato, busta_id")
      .eq("numero", numVendita)
      .single();
    expect(venDopo!.numero, "il numero fiscale resta").toBe(numVendita);
    expect(Number(venDopo!.totale), "l'importo resta").toBe(965);
    expect(Number(venDopo!.iva_totale), "l'IVA resta").toBe(174);
    expect(venDopo!.doc_numero, "il documento commerciale resta").toBe("1405-0006");
    expect(venDopo!.doc_data).toBe("2026-08-01");
    expect(venDopo!.stato).toBe("emessa");
    expect(venDopo!.busta_id, "il legame col fatto resta").toBe(busta!.id);
    expect(venDopo!.cf_cliente, "cf_cliente → NULL (l'unico campo personale della vendita)").toBeNull();

    /* ── (f) nessun residuo del nome originale in giro sul cliente ──────── */
    const testo = JSON.stringify(dopo);
    expect(testo.includes("Laura"), "il nome non deve sopravvivere da nessuna parte").toBe(false);
    expect(testo.includes("BNCLRA85M50F205Z"), "il CF non deve sopravvivere").toBe(false);
    expect(testo.includes("Via Roma 12"), "l'indirizzo non deve sopravvivere").toBe(false);
  });

  /* ══ 2 · La persona del PORTALE collegata + la non-collisione ═══════════ */

  it("C1 · la persona del portale si anonimizza e DUE anonimi non collidono sulla dedup", async () => {
    // Due clienti, ognuno con la sua persona-portale. Anonimizzandoli entrambi,
    // `telefono_grezzo` va a NULL su tutte e due: `normalizza_telefono(NULL)` è
    // '' (stringa vuota), quindi senza l'unicità PARZIALE
    // (`where telefono_normalizzato <> ''`) il SECONDO darebbe 23505.
    const c1 = await creaCliente(A, { ...PERSONALI, cognome: `Portale1 ${RUN_ID}` });
    const c2 = await creaCliente(A, { ...PERSONALI, cognome: `Portale2 ${RUN_ID}` });
    const p1 = await personaCollegata(c1);
    const p2 = await personaCollegata(c2);

    const e1 = await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c1 });
    expect(e1.error, "prima anonimizzazione").toBeNull();
    const e2 = await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c2 });
    expect(
      e2.error,
      "seconda anonimizzazione: nessuna collisione sull'indice dei telefoni (unicità parziale)"
    ).toBeNull();

    // Le due persone (chiuse a ogni client: si leggono col service role).
    const { data: persone } = await svc
      .from("persone")
      .select("id, nome, email, telefono_grezzo, telefono_normalizzato")
      .in("id", [p1, p2]);
    expect(persone!.length).toBe(2);
    for (const p of persone!) {
      // ⚠️ PUNTO SORVEGLIATO — ora CHIUSO, e questo test è ciò che lo tiene
      // chiuso. `persone` ha RLS attiva SENZA policy (ID-01, 011): sotto
      // `security invoker` l'UPDATE fatto da un utente autenticato non trovava
      // righe e passava in SILENZIO — l'anonimizzazione diceva «fatto» e
      // lasciava in piedi nome, email e telefono. La parte-persone vive ora in
      // `anonimizza_persone_del_cliente`, `security definer`, con la guardia di
      // tenant scritta dentro. Se questi expect tornano rossi, si guarda LÌ:
      // o la funzione è tornata invoker, o la delega si è persa.
      expect(p.nome, "nome → 'Anonimo' (il NOT NULL si rispetta, l'identità sparisce)").toBe(
        "Anonimo"
      );
      expect(p.email, "email → anon-<id>@invalid").toBe(`anon-${p.id}@invalid`);
      expect(p.telefono_grezzo, "telefono_grezzo → NULL: la riga ESCE dalla dedup").toBeNull();
      expect(p.telefono_normalizzato, "la colonna generata diventa stringa vuota").toBe("");
    }

    // Le prenotazioni si conservano (fatti), senza le note.
    const { data: pren } = await svc
      .from("prenotazioni")
      .select("id, note, contatto_nome")
      .in("cliente_id", [c1, c2]);
    expect(pren!.length, "le prenotazioni si conservano").toBe(2);
    expect(
      pren!.filter((p) => p.note !== null),
      "note delle prenotazioni → NULL"
    ).toEqual([]);
  });

  /* ══ 3 · I bordi dell'azione ════════════════════════════════════════════ */

  it("`anonimizza_cliente` su un cliente inesistente → CLIENTE_NON_TROVATO", async () => {
    const { error } = await A.cli.rpc("anonimizza_cliente", {
      p_cliente_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/CLIENTE_NON_TROVATO/);
  });

  it("anonimizzare due volte è innocuo (idempotente sui campi già vuoti)", async () => {
    const c = await creaCliente(A, { ...PERSONALI, cognome: `Bis ${RUN_ID}` });
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();
    const { data } = await A.cli.from("clienti").select("nome, cognome").eq("id", c).single();
    expect(data!.nome).toBe("Cliente");
    expect(data!.cognome).toBe(`Anonimizzato-${c.slice(0, 8)}`);
  });

  it("TENANT · un'altra azienda non può anonimizzare un cliente che non è suo", async () => {
    const B = await creaTenant("c1b");
    const c = await creaCliente(A, { ...PERSONALI, cognome: `Altrui ${RUN_ID}` });
    const { error } = await B.cli.rpc("anonimizza_cliente", { p_cliente_id: c });
    // Sotto RLS (security invoker) il cliente di A semplicemente NON ESISTE per B.
    expect(error, "per B quel cliente non esiste").not.toBeNull();
    expect(error!.message).toMatch(/CLIENTE_NON_TROVATO/);

    const { data } = await A.cli.from("clienti").select("nome, anonimizzato_il").eq("id", c).single();
    expect(data!.nome, "e infatti il cliente di A è intatto").toBe(PERSONALI.nome);
    expect(data!.anonimizzato_il).toBeNull();
  });

  it("C1 voce 6 · due negozi, UNA persona: A anonimizza, B resta intatto", async () => {
    // `persone` è identità di PIATTAFORMA: chi ha prenotato da due ottici è UNA
    // riga sola (la dedup sul telefono è globale). La decisione del 05/08 è
    // «sgancia-e-se-orfana-anonimizza»: A agisce sul PROPRIO grafo e non deve
    // poter portare via il contatto a B. È il caso che rende vera quella frase.
    const B = await creaTenant("c1d");
    const clienteA = await creaCliente(A, { ...PERSONALI, cognome: `Condivisa ${RUN_ID}` });
    // La persona nasce QUI (non da `personaCollegata`) perché la stessa riga
    // deve poi comparire anche sulla prenotazione di B: è il punto del test.
    const condivisa = await personaNuova();
    const persona = condivisa.id;
    await prenotazioneDi({
      aziendaId: A.aziendaId,
      persona,
      tel: condivisa.tel,
      clienteId: clienteA,
    });

    // La STESSA persona prenota anche da B (riga `persone` unica, prenotazione sua).
    // ⚠️ Con l'appuntamento: `prenotazioni.appuntamento_id` è NOT NULL dalla 013.
    await prenotazioneDi({ aziendaId: B.aziendaId, persona, tel: condivisa.tel });

    const { error } = await A.cli.rpc("anonimizza_cliente", { p_cliente_id: clienteA });
    expect(error, "A anonimizza il proprio cliente").toBeNull();

    // (1) Il grafo di A: la prenotazione ha lasciato andare la persona e le sue
    //     istantanee di contatto sono spente — il FATTO resta, il nome no.
    const { data: prenA } = await svc
      .from("prenotazioni")
      .select("persona_id, contatto_nome, contatto_telefono, contatto_email, note")
      .eq("cliente_id", clienteA);
    expect(prenA!.length, "la prenotazione di A si conserva: è un fatto").toBe(1);
    expect(prenA![0].persona_id, "…ma è SGANCIATA dall'identità di piattaforma").toBeNull();
    expect(prenA![0].contatto_nome).toBe("Anonimo");
    expect(prenA![0].contatto_telefono).toBe("");
    expect(prenA![0].contatto_email).toBeNull();
    expect(prenA![0].note, "le note libere via").toBeNull();

    // (2) Il cuore: la persona è ancora VIVA da B, quindi resta INTATTA. Se
    //     questo expect diventa rosso, un negozio sta cancellando il contatto
    //     di un altro — che è precisamente ciò che la decisione vieta.
    const { data: p } = await svc
      .from("persone")
      .select("nome, email, telefono_grezzo")
      .eq("id", persona)
      .single();
    expect(p!.nome, "la persona è viva da B: nessuno la tocca").toBe("Laura Bianchi");
    expect(p!.telefono_grezzo, "e il suo telefono resta la sua chiave di dedup").not.toBeNull();

    // (3) La prenotazione di B non è stata sfiorata.
    const { data: prenB } = await svc
      .from("prenotazioni")
      .select("persona_id, contatto_nome")
      .eq("azienda_id", B.aziendaId);
    expect(prenB!.length).toBe(1);
    expect(prenB![0].persona_id, "B tiene il suo filo verso la persona").toBe(persona);
    expect(prenB![0].contatto_nome).toBe("Laura Bianchi");

    // (4) E quando anche B se ne va, la persona diventa orfana e SOLO ALLORA si
    //     anonimizza: la mappa C1 si compie, ma alla fine della catena.
    await svc.from("prenotazioni").update({ persona_id: null }).eq("azienda_id", B.aziendaId);
    const clienteA2 = await creaCliente(A, { ...PERSONALI, cognome: `Orfana ${RUN_ID}` });
    const persona2 = await personaCollegata(clienteA2);
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: clienteA2 })).error).toBeNull();
    const { data: p2 } = await svc
      .from("persone")
      .select("nome, email, telefono_grezzo, telefono_normalizzato")
      .eq("id", persona2)
      .single();
    expect(p2!.nome, "nessun altro legame: ora sì").toBe("Anonimo");
    expect(p2!.email).toBe(`anon-${persona2}@invalid`);
    expect(p2!.telefono_grezzo).toBeNull();
    expect(p2!.telefono_normalizzato, "e la riga esce dalla dedup").toBe("");
  });

  it("C1 voce 6 · DUE clienti dello STESSO negozio, una persona sola: si sgancia solo il suo", async () => {
    // Il caso che il test «due negozi» non copre: il perimetro dello sgancio è
    // `cliente_id AND azienda_id`, e dentro UN negozio la seconda condizione non
    // discrimina. Se la funzione sganciasse per sola azienda, la prenotazione di
    // un cliente MAI toccato perderebbe la sua persona — un danno invisibile,
    // perché nessuno va a guardare il grafo di un cliente che non ha chiesto
    // nulla. Qui si guarda.
    const c1 = await creaCliente(A, { ...PERSONALI, cognome: `Coabita1 ${RUN_ID}` });
    const c2 = await creaCliente(A, { ...PERSONALI, cognome: `Coabita2 ${RUN_ID}` });
    const p = await personaNuova("Marco Coabita");
    await prenotazioneDi({ aziendaId: A.aziendaId, persona: p.id, tel: p.tel, clienteId: c1, nome: "Marco Coabita" });
    await prenotazioneDi({ aziendaId: A.aziendaId, persona: p.id, tel: p.tel, clienteId: c2, nome: "Marco Coabita" });

    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c1 })).error).toBeNull();

    const { data: pren1 } = await svc
      .from("prenotazioni")
      .select("persona_id, contatto_nome")
      .eq("cliente_id", c1)
      .single();
    expect(pren1!.persona_id, "la prenotazione del cliente anonimizzato è sganciata").toBeNull();
    expect(pren1!.contatto_nome).toBe("Anonimo");

    const { data: pren2 } = await svc
      .from("prenotazioni")
      .select("persona_id, contatto_nome")
      .eq("cliente_id", c2)
      .single();
    expect(pren2!.persona_id, "quella dell'ALTRO cliente non si tocca").toBe(p.id);
    expect(pren2!.contatto_nome, "…e nemmeno la sua istantanea di contatto").toBe("Marco Coabita");

    // …e la persona resta INTATTA: è ancora agganciata, dentro lo stesso negozio.
    const { data: viva } = await svc
      .from("persone")
      .select("nome, telefono_grezzo")
      .eq("id", p.id)
      .single();
    expect(viva!.nome, "un legame residuo, anche del MIO negozio, la tiene viva").toBe("Marco Coabita");

    // Quando se ne va anche il secondo, la catena si chiude e la riga si anonimizza.
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c2 })).error).toBeNull();
    const { data: ora } = await svc
      .from("persone")
      .select("nome, telefono_grezzo")
      .eq("id", p.id)
      .single();
    expect(ora!.nome, "ultimo filo tagliato: ORA è orfana").toBe("Anonimo");
    expect(ora!.telefono_grezzo).toBeNull();
  });

  it("C1 voce 6 · la lista d'attesa tiene viva la persona (scelta conservativa dichiarata)", async () => {
    // Nota (c) del contratto: `lista_attesa` NON è nella mappa C1 e non viene
    // toccata, quindi una sua riga rende la persona NON orfana e la riga resta
    // intatta. Il test FOTOGRAFA quella scelta invece di lasciarla implicita —
    // e mostra il suo prezzo: qui il legame residuo è del negozio STESSO che ha
    // anonimizzato, quindi la frase «il negozio A non la raggiunge più da nessun
    // suo dato» vale per le prenotazioni, non per la lista d'attesa. Se la
    // decisione di regia cambierà, è questo test a diventare rosso per primo, ed
    // è il posto giusto dove leggerne il perché.
    const c = await creaCliente(A, { ...PERSONALI, cognome: `InLista ${RUN_ID}` });
    const p = await personaNuova("Sara Lista");
    await prenotazioneDi({ aziendaId: A.aziendaId, persona: p.id, tel: p.tel, clienteId: c, nome: "Sara Lista" });
    const { error: eLista } = await svc.from("lista_attesa").insert({
      persona_id: p.id,
      azienda_id: A.aziendaId,
      servizio_codice: "visita",
    });
    if (eLista) throw new Error(`lista_attesa: ${eLista.message}`);

    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();

    // Lo SGANCIO avviene comunque: le prenotazioni del negozio lasciano andare
    // la persona e le istantanee si spengono. È la parte che non dipende da nulla.
    const { data: pren } = await svc
      .from("prenotazioni")
      .select("persona_id, contatto_nome, contatto_telefono, contatto_email")
      .eq("cliente_id", c)
      .single();
    expect(pren!.persona_id).toBeNull();
    expect(pren!.contatto_nome).toBe("Anonimo");
    expect(pren!.contatto_telefono).toBe("");
    expect(pren!.contatto_email).toBeNull();

    // La riga `persone`, invece, resta viva: la lista d'attesa la trattiene.
    const { data: persona } = await svc
      .from("persone")
      .select("nome, telefono_grezzo")
      .eq("id", p.id)
      .single();
    expect(persona!.nome, "la lista d'attesa la tiene agganciata: non si sbianca").toBe("Sara Lista");
    expect(persona!.telefono_grezzo).not.toBeNull();

    // …e il PREZZO della scelta, fotografato perché non resti implicito: tolta
    // la riga di lista, rifare l'anonimizzazione NON recupera niente. Lo sgancio
    // del primo giro ha già azzerato `persona_id`, quindi `v_persone` è vuoto e
    // non c'è più nessuna persona da valutare: l'occasione di sbiancare la riga
    // si presenta UNA volta sola, nell'istante in cui si tagliano i fili.
    // Non è un test rosso — è il comportamento reale, ed è il motivo per cui la
    // decisione su `lista_attesa` non è rimandabile all'infinito (report §ganci).
    await svc.from("lista_attesa").delete().eq("persona_id", p.id);
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();
    const { data: dopo } = await svc.from("persone").select("nome").eq("id", p.id).single();
    expect(
      dopo!.nome,
      "l'orfanità si valuta solo sui fili che si stanno tagliando: ripetere non la ritrova"
    ).toBe("Sara Lista");
  });

  it("C1 voce 6 · la definer dice QUANTE persone ha anonimizzato (0 se viva altrove)", async () => {
    // Il valore di ritorno non è decorativo: è l'unico modo che ha un chiamante
    // (oggi `anonimizza_cliente`, domani una procedura di regia) di sapere se la
    // riga di piattaforma è stata sbiancata o solo sganciata. Un `perform` lo
    // butta via, ma il contratto lo dichiara — quindi si collauda.
    const B = await creaTenant("c1e");
    const cViva = await creaCliente(A, { ...PERSONALI, cognome: `Conta1 ${RUN_ID}` });
    const p = await personaNuova("Elsa Conta");
    await prenotazioneDi({ aziendaId: A.aziendaId, persona: p.id, tel: p.tel, clienteId: cViva });
    await prenotazioneDi({ aziendaId: B.aziendaId, persona: p.id, tel: p.tel });

    const { data: zero, error: e0 } = await A.cli.rpc("anonimizza_persone_del_cliente", {
      p_cliente_id: cViva,
    });
    expect(e0).toBeNull();
    expect(zero, "viva da B: sganciata, non anonimizzata → 0").toBe(0);

    const cOrfana = await creaCliente(A, { ...PERSONALI, cognome: `Conta2 ${RUN_ID}` });
    const q = await personaNuova("Ugo Conta");
    await prenotazioneDi({ aziendaId: A.aziendaId, persona: q.id, tel: q.tel, clienteId: cOrfana });
    const { data: uno, error: e1 } = await A.cli.rpc("anonimizza_persone_del_cliente", {
      p_cliente_id: cOrfana,
    });
    expect(e1).toBeNull();
    expect(uno, "nessun altro legame: anonimizzata davvero → 1").toBe(1);
  });

  it("C1 voce 6 · `prendi_persona_come_cliente` su una prenotazione SGANCIATA si ferma parlando", async () => {
    // Da quando `persona_id` può essere NULL, il passo (d) di quella funzione
    // scriverebbe un NULL nel registro (NOT NULL) e l'operatore vedrebbe un
    // 23502 crudo. La 021 la rifà con `PRENOTAZIONE_SGANCIATA`: qui si verifica
    // che la frase esista DAVVERO, non solo nel sorgente (quello lo guarda G25e).
    //
    // Come ci si arriva: lo sgancio lascia `cliente_id` valorizzato, e con quello
    // la funzione risponde prima l'idempotenza. Il caso vero è la riga rimasta
    // senza NESSUNO dei due — cioè dopo che il cliente anonimizzato è stato
    // cancellato (FK `on delete set null`), che è l'unico modo in cui il DB può
    // produrla. L'appuntamento qui NON punta al cliente apposta: `appuntamenti.
    // cliente_id` è `on delete cascade` e `prenotazioni.appuntamento_id` è NOT
    // NULL, quindi cancellare il cliente porterebbe via l'appuntamento e la
    // cancellazione fallirebbe in cascata (23502) prima di arrivare al punto.
    const c = await creaCliente(A, { ...PERSONALI, cognome: `Sganciata ${RUN_ID}` });
    const p = await personaNuova("Nina Sgancio");
    const prenotazione = await prenotazioneDi({
      aziendaId: A.aziendaId,
      persona: p.id,
      tel: p.tel,
      clienteId: c,
      appuntamentoDelCliente: false,
    });
    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();
    const { error: eDel } = await svc.from("clienti").delete().eq("id", c);
    expect(eDel, "la cancellazione del cliente deve riuscire: è il setup del caso").toBeNull();

    const { data: prima } = await svc
      .from("prenotazioni")
      .select("persona_id, cliente_id, stato")
      .eq("id", prenotazione)
      .single();
    expect(prima!.persona_id, "sganciata").toBeNull();
    expect(prima!.cliente_id, "e senza cliente: la FK ha fatto set null").toBeNull();
    expect(prima!.stato, "…ed è ancora 'accettata', cioè prendibile per la funzione").toBe("accettata");

    const { error } = await A.cli.rpc("prendi_persona_come_cliente", {
      p_prenotazione_id: prenotazione,
      p_cliente_id: null,
    });
    expect(error, "non c'è più nessuno da prendere: deve fermarsi").not.toBeNull();
    expect(
      error!.message,
      "…e con la frase, non con un 23502 sul registro"
    ).toMatch(/PRENOTAZIONE_SGANCIATA/);
    expect(error!.message).not.toMatch(/persona_id/);
  });

  it("C1 · `per_conto_di` della prenotazione nomina un TERZO e deve sparire", async () => {
    // ⚠️ ROSSO ATTESO finché la mappa non lo comprende (vedi report §ganci).
    // `per_conto_di` è il campo che il portale riempie con «Prenoto per un'altra
    // persona»: contiene il NOME DI UN TERZO, esattamente come il `tutore_legale`
    // che C1 manda a NULL «perché identifica un TERZO per nome», e come i
    // `contatto_*` entrati in mappa il 05/08. La regola generale del contratto è
    // esplicita: «i quasi-identificatori e i testi liberi → NULL». Oggi la riga
    // sopravvive all'anonimizzazione e l'agenda la stampa ancora («· per Marco
    // Rossi»): il fatto resta, il nome del terzo pure.
    const c = await creaCliente(A, { ...PERSONALI, cognome: `PerConto ${RUN_ID}` });
    const p = await personaNuova("Chi Prenota");
    await prenotazioneDi({
      aziendaId: A.aziendaId,
      persona: p.id,
      tel: p.tel,
      clienteId: c,
      nome: "Chi Prenota",
      perContoDi: "Marco Rossi (il figlio)",
    });

    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: c })).error).toBeNull();

    const { data: pren } = await svc
      .from("prenotazioni")
      .select("per_conto_di, contatto_nome, note")
      .eq("cliente_id", c)
      .single();
    expect(pren!.contatto_nome, "le istantanee di contatto sono in mappa dal 05/08").toBe("Anonimo");
    expect(pren!.note, "le note libere pure").toBeNull();
    expect(
      pren!.per_conto_di,
      "per_conto_di è un testo libero col nome di un terzo: la regola generale di C1 lo manda a NULL"
    ).toBeNull();
  });

  it("TENANT · la definer della parte-persone si difende DA SOLA (la RLS lì non c'è più)", async () => {
    // `anonimizza_persone_del_cliente` è `security definer`: dentro, la RLS non
    // filtra più nulla. Il tenant lo tiene la guardia scritta a mano — e questo
    // test la punta dritta, chiamando la RPC come farebbe un altro negozio che
    // conosce l'id del cliente altrui (non è un'ipotesi: gli id girano negli
    // URL). Se un giorno la guardia cade, è QUI che si vede, non nella prova
    // che passa da `anonimizza_cliente` (quella è invoker e la RLS la copre).
    const B = await creaTenant("c1c");
    const c = await creaCliente(A, { ...PERSONALI, cognome: `Definer ${RUN_ID}` });
    const p = await personaCollegata(c);

    const { error } = await B.cli.rpc("anonimizza_persone_del_cliente", { p_cliente_id: c });
    expect(error, "per B quel cliente non esiste, e la funzione lo dice").not.toBeNull();
    expect(error!.message).toMatch(/CLIENTE_NON_TROVATO/);

    const { data: persona } = await svc
      .from("persone")
      .select("nome, telefono_grezzo")
      .eq("id", p)
      .single();
    expect(persona!.nome, "la persona del portale di A non è stata toccata").not.toBe("Anonimo");
    expect(persona!.telefono_grezzo, "e il suo telefono è ancora al suo posto").not.toBeNull();
  });

  it("TENANT · l'ANONIMO non può nemmeno chiamare le due funzioni (grant, non guardia)", async () => {
    // Prima linea, quella che la guardia interna non vede: `revoke execute …
    // from public, anon`. Se un giorno saltasse — per una `alter default
    // privileges` diversa, o per una funzione ricreata senza i suoi grant — la
    // parte-persone diventerebbe una definer INVOCABILE DAL MARCIAPIEDE, e la
    // guardia di tenant non salverebbe nulla: `get_azienda_id()` per l'anon è
    // NULL, quindi risponderebbe NON_AUTENTICATO… ma solo perché la guardia c'è.
    // Le due difese vanno tenute distinte, e questa prova la PRIMA: 42501.
    const senzaLogin = anonClient();
    for (const fn of ["anonimizza_persone_del_cliente", "anonimizza_cliente"]) {
      const { error } = await senzaLogin.rpc(fn, {
        p_cliente_id: "00000000-0000-0000-0000-000000000000",
      });
      expect(error, `${fn} deve essere irraggiungibile dall'anon`).not.toBeNull();
      expect(
        `${error!.code ?? ""} ${error!.message}`,
        `${fn}: all'anon deve mancare il PRIVILEGIO (42501/404), non solo il tenant`
      ).toMatch(/42501|denied|does not exist|not find/i);
    }
  });

  it("TENANT · un utente SENZA azienda si ferma su NON_AUTENTICATO (l'azienda viene dal JWT)", async () => {
    // La differenza fra questa definer e una scritta male sta tutta qui:
    // l'azienda si prende dal JWT del chiamante e MAI da un argomento. Un
    // autenticato senza riga in `utenti` (registrato ma non onboardato) ha
    // `get_azienda_id()` NULL: la funzione deve fermarsi PRIMA di guardare il
    // cliente — se rispondesse CLIENTE_NON_TROVATO, vorrebbe dire che sta
    // cercando fra i clienti di tutti.
    const c = await creaCliente(A, { ...PERSONALI, cognome: `SenzaAzienda ${RUN_ID}` });
    const orfano = await creaUtente("c1nof");
    const { error } = await orfano.cli.rpc("anonimizza_persone_del_cliente", { p_cliente_id: c });
    expect(error, "senza azienda nel JWT la funzione non deve fare nulla").not.toBeNull();
    expect(error!.message).toMatch(/NON_AUTENTICATO/);

    const { data } = await A.cli.from("clienti").select("nome").eq("id", c).single();
    expect(data!.nome, "e il cliente di A è intatto").toBe(PERSONALI.nome);
  });
});
