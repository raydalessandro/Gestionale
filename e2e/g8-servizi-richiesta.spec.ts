import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — Consegna 017 · I servizi di tipo «richiesta».
 *
 * Un negozio offre DUE forme di servizio:
 *  • appuntamento — 5 passi (Servizio → copertura → chi sei → quando+slot → conferma),
 *    l'esistente `g7-prenota.spec.ts`. Resta il collaudo di REGRESSIONE (Scenario B):
 *    NON va toccato e deve restare verde — il percorso a 5 passi non cambia con la 017.
 *  • richiesta — 3 passi (Servizio → Dettagli → Invia), NIENTE giorno/ora/griglia slot,
 *    esito «Richiesta inviata … il negozio ti risponde entro 24 ore» (Scenario A, QUI).
 *
 * UI pushata (branch `portale/017-servizi-richiesta`): selettori finalizzati sul markup
 * reale — `WizardPrenota.tsx` (percorso 3 passi) e `ottica/[slug]/page.tsx` (i due
 * gruppi di servizi). Selettori solo per ruolo/etichetta/testo — mai CSS o data-testid.
 *
 * Viewport MOBILE: il percorso vive sul telefono, in piedi sul marciapiede.
 *
 * Setup col SERVICE ROLE (portale_attivo/orari/negozi_servizi non producibili dalla UI
 * pubblica). Slug e TELEFONO unici per RUN_ID. Guardia d'ambiente come il L2.
 *
 * ⚠️ RESIDUO: la richiesta creata NON è cancellabile (trigger no-delete 011), pinna la
 * persona (FK restrict) e blocca la delete dell'azienda in cascata. Il teardown è
 * best-effort; i dati restano nel progetto di test (vedi report-test.md).
 */

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const haEnv = Boolean(URL && ANON && SERVICE);

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFISSO_SLUG = `test-${RUN_ID}-`;
const RE_CODICE = /^LMP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

function serviceClient(): SupabaseClient {
  return createClient(URL!, SERVICE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
function anonClient(): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const utentiCreati: string[] = [];

/** Telefono italiano UNICO per run (niente collisioni sull'indice di `persone`). */
function telefonoUnico(): string {
  const cifre = `${Date.now()}${Math.floor(Math.random() * 1000)}`.replace(/\D/g, "");
  return `3${cifre.slice(-9).padStart(9, "0")}`;
}

/**
 * Crea un negozio pubblicato (via onboarding) e lo semina: orari 09–13 tutti i giorni,
 * un servizio APPUNTAMENTO (visita) e un servizio RICHIESTA (sole). Ritorna slug e le
 * due etichette (dal catalogo globale servizi).
 */
async function creaNegozio(): Promise<{
  slug: string;
  etichettaAppuntamento: string;
  etichettaRichiesta: string;
}> {
  const svc = serviceClient();
  const email = `${PREFISSO_SLUG}req-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Password-123!";

  const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Titolare req" },
  });
  if (eCreate || !creato.user) throw new Error(`createUser: ${eCreate?.message ?? "utente nullo"}`);
  utentiCreati.push(creato.user.id);

  const cli = anonClient();
  const { error: eSignIn } = await cli.auth.signInWithPassword({ email, password });
  if (eSignIn) throw new Error(`signIn: ${eSignIn.message}`);

  const slug = `${PREFISSO_SLUG}req`.slice(0, 40).replace(/-$/, "");
  const { data: aziendaId, error: eRpc } = await cli.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: `Ottica Req ${RUN_ID}`,
    p_slug: slug,
    p_nome_utente: "Titolare req",
  });
  if (eRpc || !aziendaId) throw new Error(`onboarding: ${eRpc?.message ?? "id nullo"}`);
  const azienda = aziendaId as string;

  const eUpd = await svc
    .from("aziende")
    .update({ portale_attivo: true, nome_pubblico: `Ottica Req ${RUN_ID}` })
    .eq("id", azienda);
  if (eUpd.error) throw new Error(`update vetrina: ${eUpd.error.message}`);

  const orari = [0, 1, 2, 3, 4, 5, 6].map((giorno) => ({
    azienda_id: azienda,
    giorno,
    apre: "09:00",
    chiude: "13:00",
  }));
  const eO = await svc.from("orari_apertura").insert(orari);
  if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);

  // Un appuntamento (visita) + una richiesta (sole, senza durata: il trigger la vieta).
  const eS = await svc.from("negozi_servizi").insert([
    { azienda_id: azienda, servizio_codice: "visita", attivo: true },
    { azienda_id: azienda, servizio_codice: "sole", attivo: true },
  ]);
  if (eS.error) throw new Error(`seed servizi: ${eS.error.message}`);

  const { data: srv, error: eSrv } = await svc
    .from("servizi")
    .select("codice, etichetta")
    .in("codice", ["visita", "sole"]);
  if (eSrv) throw new Error(`servizi etichette: ${eSrv.message}`);
  const per = new Map((srv ?? []).map((r) => [r.codice as string, r.etichetta as string]));

  return {
    slug,
    etichettaAppuntamento: per.get("visita")!,
    etichettaRichiesta: per.get("sole")!,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

(haEnv ? test.describe : test.describe.skip)("017 · Servizio richiesta (percorso a 3 passi)", () => {
  // Mobile: il percorso vive sul telefono.
  test.use({ viewport: { width: 390, height: 844 } });

  let slug = "";
  let etichettaRichiesta = "";

  test.beforeAll(async () => {
    const n = await creaNegozio();
    slug = n.slug;
    etichettaRichiesta = n.etichettaRichiesta;
  });

  test.afterAll(async () => {
    if (!haEnv) return;
    const svc = serviceClient();
    const { data: az } = await svc.from("aziende").select("id").like("slug", `${PREFISSO_SLUG}%`);
    for (const a of az ?? []) {
      await svc.from("lista_attesa").delete().eq("azienda_id", a.id);
      await svc.from("appuntamenti").delete().eq("azienda_id", a.id);
    }
    await svc.from("aziende").delete().like("slug", `${PREFISSO_SLUG}%`);
    for (const id of utentiCreati) {
      await svc.auth.admin.deleteUser(id).catch(() => undefined);
    }
    utentiCreati.length = 0;
  });

  // ── Scenario A · dal negozio, un servizio RICHIESTA → 3 passi → «Richiesta inviata» ─
  test("servizio richiesta: 3 passi (Servizio → Dettagli → Invia), niente slot, esito «Richiesta inviata»", async ({
    page,
  }) => {
    const telefono = telefonoUnico();
    const cosaCerco = "Occhiali da sole polarizzati, modello aviatore, taglia media";
    const eRich = new RegExp(escapeRe(etichettaRichiesta)); // «Occhiali da sole»

    // ── Pagina negozio: i due gruppi (appuntamento / richiesta) ────────────────
    const resp = await page.goto(`/ottica/${slug}`);
    expect(resp?.status(), "la vetrina pubblicata risponde 200").toBe(200);

    // La sezione «Serve altro? Ti rispondiamo entro 24 ore» ospita le richieste:
    // ogni voce è un LINK verso il percorso guidato, col badge «Su richiesta ›».
    await expect(page.getByText(/Ti rispondiamo entro 24 ore/i)).toBeVisible();
    const voceRichiesta = page.getByRole("link", { name: eRich });
    await expect(voceRichiesta).toHaveAttribute("href", new RegExp(`/ottica/${slug}/prenota`));
    await voceRichiesta.click();
    await expect(page).toHaveURL(/\/prenota/);

    // ── Passo 1 · «Che cosa ti serve?» → scelgo il servizio di tipo RICHIESTA ──
    // (badge «Su richiesta»; per l'appuntamento sarebbe «N min»).
    await expect(page.getByRole("heading", { name: "Che cosa ti serve?" })).toBeVisible();
    await page.getByRole("button", { name: eRich }).click();

    // ── Passo 2 · «Raccontaci in breve»: textarea + contatti, NIENTE slot ──────
    await expect(page.getByRole("heading", { name: "Raccontaci in breve" })).toBeVisible();
    // Indicatore di percorso: «Passo 2 di 3» — è il ramo a 3 passi, non a 5.
    await expect(
      page.getByText("Passo 2 di 3"),
      "il servizio richiesta prende la forma a 3 passi"
    ).toBeVisible();

    await page.getByLabel(/Che cosa cerchi/i).fill(cosaCerco); // obbligatoria
    await page.getByLabel(/Nome e cognome/i).fill("Laura Bianchi");
    await page.getByLabel(/Telefono/i).fill(telefono);

    // INVARIANTE FORTE della 017: per una richiesta NON compare nessuna griglia di
    // slot orari, né il passo «Quando» — in nessun momento del percorso.
    await expect(
      page.getByRole("button", { name: /^\d{2}:\d{2}$/ }),
      "una richiesta non mostra slot orari"
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Quando ti va bene/i }),
      "una richiesta non ha il passo «Quando»"
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Continua" }).click();

    // ── Passo 3 · «Ci siamo»: informativa OBBLIGATORIA, poi Invia ─────────────
    await expect(page.getByRole("heading", { name: "Ci siamo" })).toBeVisible();
    await expect(page.getByText("Passo 3 di 3")).toBeVisible();
    const invia = page.getByRole("button", { name: "Invia la richiesta" });
    await expect(invia, "l'Invia nasce disabilitato finché non si accetta l'informativa").toBeDisabled();
    await page.getByRole("checkbox", { name: /informativa privacy/i }).check();
    await expect(invia).toBeEnabled();
    await invia.click();

    // ── Schermata finale · «Richiesta inviata … entro 24 ore», col codice ─────
    await expect(page.getByText(/Richiesta inviata/i)).toBeVisible();
    await expect(
      page.getByText(/entro 24 ore/i),
      "il messaggio onesto: il negozio risponde entro 24 ore"
    ).toBeVisible();
    // niente riga «Quando»/«Durata» sul riepilogo di una richiesta.
    await expect(page.getByText("Durata", { exact: true }), "una richiesta non ha durata").toHaveCount(0);
    const codiceEl = page.getByText(RE_CODICE);
    await expect(codiceEl).toBeVisible();
    const codice = (await codiceEl.textContent())?.trim() ?? "";
    expect(codice).toMatch(RE_CODICE);

    // ── Verifica a valle nel DB: è una richiesta senza slot, col testo nelle note ─
    const svc = serviceClient();
    const { data: pren, error } = await svc
      .from("prenotazioni")
      .select("stato, servizio_codice, appuntamento_id, inizio, durata_minuti, note, contatto_nome, contatto_telefono")
      .eq("codice", codice)
      .single();
    expect(error, error?.message).toBeFalsy();
    expect(pren!.servizio_codice, "il servizio scelto è la richiesta").toBe("sole");
    expect(pren!.stato, "una richiesta nasce in_attesa").toBe("in_attesa");
    expect(pren!.appuntamento_id, "nessun appuntamento per una richiesta").toBeNull();
    expect(pren!.inizio, "niente inizio").toBeNull();
    expect(pren!.durata_minuti, "niente durata").toBeNull();
    expect(pren!.note, "il testo «Che cosa cerchi?» finisce nelle note").toBe(cosaCerco);
    expect(pren!.contatto_nome).toBe("Laura Bianchi");
    expect(pren!.contatto_telefono).toBe(telefono);
  });
});
