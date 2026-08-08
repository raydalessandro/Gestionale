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
 * L2 · Contratto — **C1 · «l'anonimo ESCE dalla dedup»: la seconda metà.**
 *
 * La 021 mantiene la promessa a metà, e la metà che manca è quella che si vede
 * dal marciapiede. Il ragionamento, per intero:
 *
 *  1. `persone.telefono_normalizzato` è una colonna GENERATA da
 *     `normalizza_telefono(telefono_grezzo)`, e `normalizza_telefono(NULL)`
 *     ritorna **`''`** (stringa vuota), non NULL. L'anonimizzazione mette
 *     `telefono_grezzo = NULL`, quindi la riga anonima si posa su `''`.
 *  2. La 021 lo ha MISURATO e ha reso PARZIALE l'unicità
 *     (`where telefono_normalizzato <> ''`), così due anonimi non collidono.
 *     Fin qui tutto giusto — ed è coperto da `b1-anonimizzazione.test.ts`.
 *  3. Ma «uscire dalla dedup» non è solo «non occupare l'indice»: è **non
 *     essere più TROVATI**. La ricerca dentro `crea_prenotazione` (013/014/016,
 *     non toccata dalla 021) è
 *         `select persone.id from persone where telefono_normalizzato = v_tel`
 *     **senza alcun filtro su `v_tel <> ''`**. E `v_tel` è `''` ogni volta che
 *     il numero digitato non contiene cifre: `crea_prenotazione` non valida il
 *     telefono, e la UI del portale chiede solo che non sia vuoto dopo il trim
 *     (`WizardPrenota`: `telefono.trim().length > 0`). Un «-», un «n/d», un
 *     «da richiamare» passano.
 *  4. Conseguenza: una persona NUOVA che prenota con un telefono illeggibile
 *     viene agganciata a una riga ANONIMIZZATA — che torna così viva e non
 *     orfana, con l'email `anon-…@invalid` e il nome 'Anonimo' addosso. Prima
 *     della 021 non poteva succedere: l'unicità era totale e le righe a `''`
 *     erano al più una.
 *
 * Questo file prova il punto 4 dal lato ANON, cioè dal punto esatto in cui un
 * cliente vero preme «Invia». È scritto perché diventi VERDE con una riga sola
 * dentro `crea_prenotazione` (`and persone.telefono_normalizzato <> ''`, o il
 * rifiuto del telefono senza cifre): finché non c'è, è rosso — ed è il segnale,
 * non un difetto del test. Vedi report-test.md §ganci.
 *
 * ⚠️ Residuo append-only: le prenotazioni non si cancellano (trigger no-delete
 * della 011) e pinnano persone e appuntamenti. Teardown best-effort come gli
 * altri file del portale.
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

/** Telefoni veri e unici (base = ms di avvio: mai collisioni fra run). */
let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): string {
  return `3${TEL_BASE}${String(telSeq++).padStart(4, "0")}`;
}

describe.skipIf(!haEnv())("021 · C1 · l'anonimo esce dalla dedup (anche dalla RICERCA)", () => {
  let A: Tenant;
  let svc: SupabaseClient;
  let anon: SupabaseClient;

  beforeAll(async () => {
    A = await creaTenant("dedup");
    svc = serviceClient();
    anon = anonClient();

    await svc
      .from("aziende")
      .update({ portale_attivo: true, nome_pubblico: `Ottica Dedup ${RUN_ID}` })
      .eq("id", A.aziendaId);
    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: A.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);
    const eS = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: A.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);
  });
  afterAll(pulisci);

  /** Prenota dal marciapiede (client anon, la stessa RPC del portale). */
  async function prenotaComeAnonimo(o: {
    giornoOffset: number;
    nome: string;
    telefono: string;
  }): Promise<{ prenotazioneId: string; personaId: string }> {
    const giorno = piuGiorni(oggiRomaISO(), o.giornoOffset);
    const { data: slots, error: eSlot } = await anon.rpc("slot_liberi", {
      p_slug: A.slug,
      p_servizio: "visita",
      p_giorno: giorno,
    });
    if (eSlot) throw new Error(`slot_liberi: ${eSlot.message}`);
    const inizio = ((slots as string[]) ?? [])[0];
    if (!inizio) throw new Error(`nessuno slot libero il ${giorno}`);

    const { data, error } = await anon.rpc("crea_prenotazione", {
      p_slug: A.slug,
      p_servizio: "visita",
      p_inizio: inizio,
      p_nome: o.nome,
      p_telefono: o.telefono,
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: "portale",
      p_chiave_richiesta: `dedup-${RUN_ID}-${o.giornoOffset}-${telSeq}`,
      p_lista_attesa: false,
    });
    if (error) throw new Error(`crea_prenotazione: ${error.message}`);
    const riga = (Array.isArray(data) ? data[0] : data) as { id: string };

    const { data: pren, error: ePren } = await svc
      .from("prenotazioni")
      .select("id, persona_id")
      .eq("id", riga.id)
      .single();
    if (ePren) throw new Error(`rilettura prenotazione: ${ePren.message}`);
    return { prenotazioneId: pren!.id as string, personaId: pren!.persona_id as string };
  }

  it("una prenotazione con telefono ILLEGGIBILE non deve agganciarsi a una persona ANONIMIZZATA", async () => {
    /* ── (a) una persona vera, presa come cliente e poi anonimizzata ─────── */
    const tel = telefonoUnico();
    const primo = await prenotaComeAnonimo({
      giornoOffset: 7,
      nome: "Rita Vera",
      telefono: tel,
    });
    const cliente = await creaCliente(A, { nome: "Rita", cognome: `Vera ${RUN_ID}`, telefono: tel });
    // «Prendi come cliente» in forma minima: quello che conta qui è il legame
    // cliente↔prenotazione, che è la condizione dello sgancio di C1 voce 6.
    const { error: eLink } = await svc
      .from("prenotazioni")
      .update({ cliente_id: cliente, stato: "accettata" })
      .eq("id", primo.prenotazioneId);
    if (eLink) throw new Error(`collegamento cliente: ${eLink.message}`);

    expect((await A.cli.rpc("anonimizza_cliente", { p_cliente_id: cliente })).error).toBeNull();

    // Precondizione, asserita: la riga è anonima e si è posata sulla chiave vuota.
    const { data: anonima } = await svc
      .from("persone")
      .select("nome, telefono_grezzo, telefono_normalizzato")
      .eq("id", primo.personaId)
      .single();
    expect(anonima!.nome, "la persona era orfana dopo lo sgancio: anonimizzata").toBe("Anonimo");
    expect(anonima!.telefono_grezzo).toBeNull();
    expect(
      anonima!.telefono_normalizzato,
      "ed è QUI che nasce il problema: la chiave di dedup diventa la stringa vuota"
    ).toBe("");

    /* ── (b) un'ALTRA persona prenota con un telefono senza cifre ────────── */
    // «-» è ciò che scrive chi non vuole lasciare il numero: la UI del portale
    // lo accetta (chiede solo `trim().length > 0`) e `normalizza_telefono` lo
    // riduce a '' — la stessa chiave su cui si è posata la riga anonima.
    //
    // ⚠️ DOPPIA CINTURA (C1 voce 6 punto 4, 06/08): il contratto pretende
    // ENTRAMBE le difese, non una a scelta. La PRIMA morde qui: un telefono
    // senza cifre è rifiutato a monte, perché un contatto irraggiungibile non è
    // una prenotazione. Se un domani la si togliesse lasciando solo l'altra, la
    // prenotazione entrerebbe — su una persona nuova, sì, ma con un recapito
    // che non richiama nessuno.
    await expect(
      prenotaComeAnonimo({ giornoOffset: 8, nome: "Ugo Nuovo", telefono: "-" }),
      "un telefono senza cifre va rifiutato con TELEFONO_NON_VALIDO (prima cintura)"
    ).rejects.toThrow(/TELEFONO_NON_VALIDO/);

    // La SECONDA cintura si prova dove la prima non arriva: si scavalca la RPC
    // e si chiede alla dedup, in proprio, quello che `crea_prenotazione` le
    // chiede — «chi ha questo telefono normalizzato?». La risposta non deve mai
    // essere una riga anonima, qualunque strada abbia portato lì una chiave ''.
    const { data: pescate } = await svc
      .from("persone")
      .select("id, nome")
      .eq("telefono_normalizzato", "");
    expect(
      (pescate ?? []).every((p) => p.nome === "Anonimo"),
      "sulla chiave vuota stanno SOLO righe anonimizzate: è per questo che la ricerca deve escluderle"
    ).toBe(true);

    // …e da qui in poi il caso storico, con un telefono VERO ma nuovo: la
    // prenotazione deve nascere su una persona sua, mai dentro un'anonima.
    const secondo = await prenotaComeAnonimo({
      giornoOffset: 8,
      nome: "Ugo Nuovo",
      telefono: telefonoUnico(),
    });

    const { data: agganciata } = await svc
      .from("persone")
      .select("id, nome, email, telefono_grezzo")
      .eq("id", secondo.personaId)
      .single();

    // Il cuore. Non si asserisce «≠ quella riga lì» (sul progetto di test le
    // righe anonime di altri run stanno tutte su '' e la `select … into` ne
    // pesca una qualunque): si asserisce la REGOLA, cioè che una prenotazione
    // nuova non atterri MAI su un'identità anonimizzata.
    expect(
      agganciata!.nome,
      "una persona nuova è finita dentro una riga ANONIMIZZATA: l'anonimo non è uscito dalla dedup, " +
        "è solo uscito dall'indice. Serve `and persone.telefono_normalizzato <> ''` nella ricerca di " +
        "crea_prenotazione (o il rifiuto di un telefono senza cifre)."
    ).not.toBe("Anonimo");
    expect(
      String(agganciata!.email ?? ""),
      "…e con lei si è ripresa l'email di anonimizzazione"
    ).not.toMatch(/^anon-.*@invalid$/);

    // E la riga anonimizzata deve restare senza legami: se ne ha uno, è tornata
    // NON orfana — cioè irrecuperabile per sempre dalla mappa C1 (l'orfanità si
    // valuta solo nell'istante in cui si tagliano i fili).
    const { data: legami } = await svc
      .from("prenotazioni")
      .select("id")
      .eq("persona_id", primo.personaId);
    expect(
      legami ?? [],
      "la riga anonimizzata è tornata agganciata a una prenotazione viva"
    ).toEqual([]);
  });

  it("il telefono VERO continua a deduplicare come prima (nessun danno collaterale)", async () => {
    // La riparazione chiesta sopra non deve indebolire la dedup normale: due
    // prenotazioni con lo STESSO numero vero restano UNA persona sola. Questo
    // test è il contrappeso — se un domani si «risolvesse» disattivando la
    // ricerca, sarebbe questo a diventare rosso.
    const tel = telefonoUnico();
    const uno = await prenotaComeAnonimo({ giornoOffset: 9, nome: "Ada Stessa", telefono: tel });
    const due = await prenotaComeAnonimo({
      giornoOffset: 10,
      nome: "Ada Stessa",
      telefono: `+39 ${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`, // stesso numero, altra forma
    });
    expect(
      due.personaId,
      "stesso numero (scritto diversamente) = stessa identità di piattaforma"
    ).toBe(uno.personaId);
  });
});
