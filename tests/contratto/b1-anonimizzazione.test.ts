import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  creaCliente,
  serviceClient,
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
function telefonoUnico(): string {
  const base = Array.from(RUN_ID)
    .map((c) => c.charCodeAt(0) % 10)
    .join("")
    .padEnd(3, "0")
    .slice(0, 3);
  return `3${base}${String(telSeq++).padStart(6, "0")}`;
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

  /** Crea una persona di portale + la sua prenotazione agganciata al cliente. */
  async function personaCollegata(clienteId: string): Promise<string> {
    const inizio = slotFuturo();
    const { data: app, error: eApp } = await A.cli
      .from("appuntamenti")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteId,
        tipo: "controllo_vista",
        inizio,
        durata_minuti: 30,
        stato: "prenotato",
        note: "portata dal portale",
      })
      .select("id")
      .single();
    if (eApp) throw new Error(`appuntamento per la prenotazione: ${eApp.message}`);

    const tel = telefonoUnico();
    const { data: persona, error: eP } = await svc
      .from("persone")
      .insert({ telefono_grezzo: tel, nome: "Laura Bianchi", email: `p.${tel}@esempio.it` })
      .select("id")
      .single();
    if (eP) throw new Error(`persona: ${eP.message}`);

    const { error: ePren } = await svc.from("prenotazioni").insert({
      azienda_id: A.aziendaId,
      persona_id: persona!.id,
      cliente_id: clienteId,
      appuntamento_id: app!.id,
      servizio_codice: "visita",
      inizio,
      durata_minuti: 30,
      contatto_nome: "Laura Bianchi",
      contatto_telefono: tel,
      contatto_email: `p.${tel}@esempio.it`,
      note: "chiamare dopo le 15",
    });
    if (ePren) throw new Error(`prenotazione: ${ePren.message}`);
    return persona!.id as string;
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
      // ⚠️ PUNTO SORVEGLIATO (vedi report-test.md · B1): `anonimizza_cliente` è
      // `security invoker` e `persone` ha RLS attiva SENZA policy (ID-01, 011) —
      // l'UPDATE su `persone` fatto da un utente autenticato non trova righe e
      // passa in SILENZIO. Se questi expect sono rossi, il buco è lì: serve una
      // funzione `security definer` per la parte-persone, non un test diverso.
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
});
