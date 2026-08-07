import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { registraTenant, creaCliente, aziendaIdDaSlug } from "./_helpers";

/**
 * L3 · E2E — G8 · Le RICHIESTE DAL PORTALE dentro l'agenda (migrazione 018).
 *
 * La §1 (caratterizzazione del flusso appuntamenti «com'è oggi») vive nell'altro
 * file `g8-richieste-agenda.spec.ts` ed è SOLO UI. Qui stanno gli scenari NUOVI,
 * che hanno bisogno di una richiesta VERA arrivata dal portale: si semina con la
 * stessa RPC `crea_prenotazione` che usa il marciapiede (via service role per
 * pubblicare il negozio + orari/servizio, poi anon per la scrittura), e la si
 * lavora dalla UI dell'agenda del titolare loggato.
 *
 * Gated su `haEnv`: senza i secret del progetto di test questi scenari non
 * possono girare (li accende la CI). Selettori solo per ruolo/etichetta/testo.
 * Ogni test crea il SUO tenant usa-e-getta. Telefoni unici per RUN_ID.
 *
 * ⚠️ RESIDUO append-only come g7: la prenotazione non è cancellabile, il teardown
 * è best-effort (vedi report-test.md).
 */

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const haEnv = Boolean(URL && ANON && SERVICE);

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function serviceClient(): SupabaseClient {
  return createClient(URL!, SERVICE!, { auth: { autoRefreshToken: false, persistSession: false } });
}
function anonClient(): SupabaseClient {
  return createClient(URL!, ANON!, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Telefono italiano UNICO per run — 10 cifre esatte, contatore intero. */
let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): string {
  return `3${TEL_BASE}${String(telSeq++).padStart(2, "0")}`; // 10 cifre, base=ms avvio: unica tra run e suite
}

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

type Seminato = {
  aziendaId: string;
  giorno: string; // YYYY-MM-DD della richiesta
  inizio: string; // ISO dell'appuntamento
  nome: string;
  telefono: string;
  codice: string;
};

/**
 * Registra un tenant DALLA UI (il browser resta loggato come titolare), poi lo
 * pubblica e semina orari/servizio col service role e, come il portale, invia una
 * RICHIESTA (in_attesa) via `crea_prenotazione` su un giorno futuro dedicato.
 */
async function preparaRichiesta(
  page: Page,
  o: { nome?: string; telefono?: string; giornoOffset?: number } = {}
): Promise<Seminato> {
  const t = await registraTenant(page);
  const aziendaId = await aziendaIdDaSlug(t.slug);
  const svc = serviceClient();
  const anon = anonClient();

  await svc
    .from("aziende")
    .update({ portale_attivo: true, nome_pubblico: `Ottica G8 ${RUN_ID}` })
    .eq("id", aziendaId);
  const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
    azienda_id: aziendaId,
    giorno: g,
    apre: "09:00",
    chiude: "17:00",
  }));
  const eO = await svc.from("orari_apertura").insert(orari);
  if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);
  const eS = await svc
    .from("negozi_servizi")
    .insert({ azienda_id: aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
  if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);

  const giorno = piuGiorni(oggiRomaISO(), o.giornoOffset ?? 7);
  const { data: slots, error: eSlot } = await anon.rpc("slot_liberi", {
    p_slug: t.slug,
    p_servizio: "visita",
    p_giorno: giorno,
  });
  if (eSlot) throw new Error(`slot_liberi: ${eSlot.message}`);
  const inizio = ((slots as string[]) ?? [])[0];
  if (!inizio) throw new Error(`nessuno slot libero il ${giorno}`);

  const nome = o.nome ?? "Anna Verdi";
  const telefono = o.telefono ?? telefonoUnico();
  const { data, error } = await anon.rpc("crea_prenotazione", {
    p_slug: t.slug,
    p_servizio: "visita",
    p_inizio: inizio,
    p_nome: nome,
    p_telefono: telefono,
    p_email: "",
    p_per_conto_di: "",
    p_note: "",
    p_fonte: "qr_vetrina",
    p_chiave_richiesta: `e2e-${RUN_ID}-${telefono}-${inizio}`,
    p_lista_attesa: false,
  });
  if (error) throw new Error(`crea_prenotazione: ${error.message}`);
  const riga = (Array.isArray(data) ? data[0] : data)!;
  return { aziendaId, giorno, inizio, nome, telefono, codice: riga.codice as string };
}

/** Teardown best-effort: cancella gli appuntamenti non collegati + tenta l'azienda. */
async function pulisciAzienda(aziendaId: string): Promise<void> {
  const svc = serviceClient();
  await svc.from("lista_attesa").delete().eq("azienda_id", aziendaId);
  const { data: prens } = await svc
    .from("prenotazioni")
    .select("appuntamento_id")
    .eq("azienda_id", aziendaId);
  const collegati = (prens ?? [])
    .map((p) => p.appuntamento_id as string | null)
    .filter((x): x is string => Boolean(x));
  let q = svc.from("appuntamenti").delete().eq("azienda_id", aziendaId);
  if (collegati.length) q = q.not("id", "in", `(${collegati.join(",")})`);
  await q;
  await svc.from("aziende").delete().eq("id", aziendaId).then(undefined, () => undefined);
}

(haEnv ? test.describe : test.describe.skip)("G8 · Richieste dal portale dentro l'agenda", () => {
  // workers:1 è già in playwright.config. Ogni test crea il SUO tenant: nessuna
  // dipendenza fra loro, nessun mode serial (un fallimento non maschera gli altri).

  test("La richiesta compare nella striscia «in sospeso» e nel giorno giusto", async ({ page }) => {
    const s = await preparaRichiesta(page, { nome: "Carla Sospesa" });
    try {
      // L'agenda di OGGI: la striscia dei sospesi guarda da oggi in avanti.
      await page.goto("/agenda");
      await expect(page.getByText("1 richiesta in sospeso")).toBeVisible();
      // La voce della striscia porta il nome del richiedente ed è un link al giorno.
      const voce = page.getByRole("link", { name: /Carla Sospesa/ });
      await expect(voce).toBeVisible();
      await expect(voce).toHaveAttribute("href", `/agenda?data=${s.giorno}`);

      // Seguendo il link si arriva al giorno con la riga «In attesa».
      await voce.click();
      await expect(page).toHaveURL(new RegExp(`data=${s.giorno}`));
      await expect(page.getByText("In attesa", { exact: true })).toBeVisible();
      // `exact`: sullo stesso giorno il nome compare DUE volte — nella riga
      // («Carla Sospesa») e nella striscia dei sospesi («· Carla Sospesa», che
      // guarda da oggi in avanti). Esatto aggancia solo la riga, non la striscia.
      await expect(page.getByText("Carla Sospesa", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Accetta" })).toBeVisible();
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });

  test("Accetta dall'agenda → pill «Prenotato» e i bottoni cambiano", async ({ page }) => {
    const s = await preparaRichiesta(page, { nome: "Bruno Accetta" });
    try {
      await page.goto(`/agenda?data=${s.giorno}`);
      await expect(page.getByText("In attesa", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Accetta" }).click();

      await expect(page.getByText("Prenotato", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Completato" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Non presentato" })).toBeVisible();
      // «Accetta» sparisce, appare l'atto separato «Prendi come cliente».
      await expect(page.getByRole("button", { name: "Accetta" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Prendi come cliente" })).toBeVisible();
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });

  test("Rifiuta dall'agenda → pill «Annullato»", async ({ page }) => {
    const s = await preparaRichiesta(page, { nome: "Dario Rifiuta" });
    try {
      await page.goto(`/agenda?data=${s.giorno}`);
      await expect(page.getByText("In attesa", { exact: true })).toBeVisible();

      // Motivo facoltativo + bottone Rifiuta (form nudo con placeholder).
      await page.getByPlaceholder("Motivo (facolt.)").fill("non disponibile");
      await page.getByRole("button", { name: "Rifiuta" }).click();

      await expect(page.getByText("Annullato", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Accetta" })).toHaveCount(0);
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });

  test("«Prendi come cliente» con telefono GIÀ presente → propone «Collega quello»", async ({ page }) => {
    const tel = telefonoUnico();
    const s = await preparaRichiesta(page, { nome: "Elena Doppia", telefono: tel });
    try {
      // Un cliente col MEDESIMO numero esiste già nel negozio.
      await creaCliente(page, { nome: "Elena", cognome: "Preesistente", telefono: tel });

      await page.goto(`/agenda?data=${s.giorno}`);
      await page.getByRole("button", { name: "Accetta" }).click();
      await expect(page.getByRole("button", { name: "Prendi come cliente" })).toBeVisible();

      await page.getByRole("button", { name: "Prendi come cliente" }).click();

      // La ricerca per telefono trova il preesistente → proposta di collegamento.
      await expect(page.getByText(/con questo numero/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Collega quello" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Crea nuovo" })).toBeVisible();

      // Collego l'esistente → esito finale.
      await page.getByRole("button", { name: "Collega quello" }).click();
      await expect(page.getByText("Preso come cliente ✓")).toBeVisible();
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });

  test("Giro completo: dal portale all'agenda al cliente creato", async ({ page }) => {
    const s = await preparaRichiesta(page, { nome: "Franco Nuovo" });
    try {
      // 1) la richiesta è arrivata: la lavoro dal giorno.
      await page.goto(`/agenda?data=${s.giorno}`);
      await expect(page.getByText("In attesa", { exact: true })).toBeVisible();

      // 2) l'accetto.
      await page.getByRole("button", { name: "Accetta" }).click();
      await expect(page.getByText("Prenotato", { exact: true })).toBeVisible();

      // 3) la prendo come cliente: telefono NUOVO → crea subito, senza proposta.
      await page.getByRole("button", { name: "Prendi come cliente" }).click();
      await expect(page.getByText("Preso come cliente ✓")).toBeVisible();

      // 4) verifica a valle nel DB: il cliente esiste, senza consenso commerciale,
      //    con la fonte del canale (qr_vetrina), collegato alla prenotazione.
      const svc = serviceClient();
      const { data: pren } = await svc
        .from("prenotazioni")
        .select("cliente_id, stato")
        .eq("codice", s.codice)
        .single();
      expect(pren?.stato, "la richiesta è accettata").toBe("accettata");
      expect(pren?.cliente_id, "la prenotazione è collegata a un cliente").toBeTruthy();
      const { data: cli } = await svc
        .from("clienti")
        .select("nome, cognome, telefono, fonte, consenso_marketing")
        .eq("id", pren!.cliente_id as string)
        .single();
      expect(cli?.telefono).toBe(s.telefono);
      expect(cli?.fonte, "la fonte del canale è arrivata fino al cliente").toBe("qr_vetrina");
      expect(cli?.consenso_marketing, "nessun consenso commerciale automatico").toBe(false);
      expect(cli?.nome).toBe("Franco");
      expect(cli?.cognome).toBe("Nuovo");
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });

  /**
   * C1 · voce 6 — «SGANCIA, e se orfana anonimizza», dal gesto vero.
   *
   * Il L2 (`tests/contratto/b1-anonimizzazione.test.ts`) semina persona e
   * prenotazione col service role: prova la funzione, non la strada. Qui la
   * persona nasce da `crea_prenotazione` come dal marciapiede, il legame col
   * cliente lo fa il BOTTONE «Prendi come cliente», e l'anonimizzazione passa
   * dalla conferma battuta a mano. Se un giorno il percorso reale producesse una
   * riga leggermente diversa da quella seminata a mano, è qui che si vede.
   *
   * Due cose si guardano, e sono di natura diversa:
   *  · a video, in AGENDA: la riga del giorno non nomina più chi ha prenotato;
   *  · a valle, nel DB: la prenotazione è sganciata (`persona_id → NULL`), le sue
   *    istantanee di contatto sono spente, e la riga `persone` — rimasta orfana,
   *    perché quel negozio era l'unico ad averla — è anonimizzata e fuori dalla
   *    dedup.
   */
  test("Anonimizzazione dopo la presa: la richiesta resta, l'identità di piattaforma no", async ({
    page,
  }) => {
    const s = await preparaRichiesta(page, { nome: "Gina Sganciata" });
    try {
      // 1) accetto e prendo come cliente: il giro normale del banco.
      await page.goto(`/agenda?data=${s.giorno}`);
      await page.getByRole("button", { name: "Accetta" }).click();
      await page.getByRole("button", { name: "Prendi come cliente" }).click();
      await expect(page.getByText("Preso come cliente ✓")).toBeVisible();

      const svc = serviceClient();
      const { data: pren } = await svc
        .from("prenotazioni")
        .select("id, cliente_id, persona_id")
        .eq("codice", s.codice)
        .single();
      const clienteId = pren!.cliente_id as string;
      const personaId = pren!.persona_id as string;
      expect(personaId, "prima dell'anonimizzazione il filo verso la persona c'è").toBeTruthy();

      // 2) il gesto protetto, sulla scheda del cliente appena creato.
      await page.goto(`/clienti/${clienteId}`);
      await page.getByRole("button", { name: "Eliminazione definitiva" }).click();
      await page.getByLabel("Scrivi ELIMINA per confermare").fill("ELIMINA");
      await page.getByRole("button", { name: "Anonimizza definitivamente" }).click();
      await expect(page.getByText(/^Anonimizzato-/)).toBeVisible();

      // 3) in AGENDA l'appuntamento resta (è un fatto), ma non porta più il nome.
      //    Si asserisce sul LINK della riga — il nome è un link alla scheda — non
      //    sul testo della pagina: un `getByText(nome).toHaveCount(0)` sarebbe
      //    vero anche se la pagina non avesse caricato, e falso se una qualunque
      //    schermata di servizio citasse il nome.
      await page.goto(`/agenda?data=${s.giorno}`);
      await expect(
        page.getByRole("link", { name: /Gina Sganciata/ }),
        "il nome di chi ha prenotato non compare più in agenda"
      ).toHaveCount(0);
      await expect(page.getByText("Gina Sganciata", { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /Anonimizzato-/ }),
        "…al suo posto c'è l'anonimo, e la riga del giorno è ancora lì"
      ).toBeVisible();

      // 4) a valle: sgancio + istantanee spente + persona orfana anonimizzata.
      const { data: dopo } = await svc
        .from("prenotazioni")
        .select("persona_id, contatto_nome, contatto_telefono, contatto_email, stato")
        .eq("codice", s.codice)
        .single();
      expect(dopo!.stato, "la richiesta resta accettata: è un fatto").toBe("accettata");
      expect(dopo!.persona_id, "SGANCIO: il filo verso l'identità di piattaforma è tagliato").toBeNull();
      expect(dopo!.contatto_nome).toBe("Anonimo");
      expect(dopo!.contatto_telefono).toBe("");
      expect(dopo!.contatto_email).toBeNull();

      const { data: persona } = await svc
        .from("persone")
        .select("nome, email, telefono_grezzo, telefono_normalizzato")
        .eq("id", personaId)
        .single();
      expect(persona!.nome, "era agganciata solo a questo negozio: orfana → anonimizzata").toBe(
        "Anonimo"
      );
      expect(persona!.email).toBe(`anon-${personaId}@invalid`);
      expect(persona!.telefono_grezzo, "…e il numero, che era la sua chiave, non c'è più").toBeNull();
      expect(persona!.telefono_normalizzato).toBe("");
    } finally {
      await pulisciAzienda(s.aziendaId);
    }
  });
});
