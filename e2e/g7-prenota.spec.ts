import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — G7 · Il percorso di prenotazione (/ottica/[slug]/prenota).
 *
 * La PRIMA scrittura del portale, dal marciapiede: una persona scansiona il QR
 * in vetrina (?da=qr), tocca «Prenota», e in 5 passi INVIA una RICHIESTA (stato
 * in_attesa). Il collaudo:
 *  1. da /ottica/<slug>?da=qr → CTA «Prenota» → i 5 passi → schermata finale con
 *     un CODICE e il messaggio ONESTO: «richiesta», mai «prenotazione confermata»;
 *  2. l'informativa è OBBLIGATORIA: «Invia» resta disabilitato finché non si spunta;
 *  3. a valle, nel DB, la fonte registrata è `qr_vetrina` (la provenienza del QR
 *     ha attraversato tutto il percorso).
 *
 * Viewport MOBILE: il percorso è pensato per una mano sola sul telefono.
 *
 * Setup col SERVICE ROLE (portale_attivo/orari/servizio non producibili dalla UI
 * pubblica). Slug e TELEFONO unici per RUN_ID. Guardia d'ambiente come il L2.
 *
 * ⚠️ RESIDUO: la prenotazione creata NON è cancellabile (trigger no-delete 011),
 * pinna la persona (FK restrict) e blocca la delete dell'azienda in cascata. Il
 * teardown è best-effort; i dati restano nel progetto di test (vedi report-test.md).
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
  return `3${cifre.slice(-9).padStart(9, "0")}`; // 3 + 9 cifre
}

/** Crea un negozio pubblicato (via onboarding) e lo semina: orari 09–13 tutti i
 *  giorni + servizio visita attivo. Ritorna slug e l'etichetta del servizio. */
async function creaNegozio(): Promise<{ slug: string; etichetta: string }> {
  const svc = serviceClient();
  const email = `${PREFISSO_SLUG}pren-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Password-123!";

  const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Titolare pren" },
  });
  if (eCreate || !creato.user) throw new Error(`createUser: ${eCreate?.message ?? "utente nullo"}`);
  utentiCreati.push(creato.user.id);

  const cli = anonClient();
  const { error: eSignIn } = await cli.auth.signInWithPassword({ email, password });
  if (eSignIn) throw new Error(`signIn: ${eSignIn.message}`);

  const slug = `${PREFISSO_SLUG}pren`.slice(0, 40).replace(/-$/, "");
  const { data: aziendaId, error: eRpc } = await cli.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: `Ottica Pren ${RUN_ID}`,
    p_slug: slug,
    p_nome_utente: "Titolare pren",
  });
  if (eRpc || !aziendaId) throw new Error(`onboarding: ${eRpc?.message ?? "id nullo"}`);
  const azienda = aziendaId as string;

  const eUpd = await svc
    .from("aziende")
    .update({ portale_attivo: true, nome_pubblico: `Ottica Pren ${RUN_ID}` })
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

  const eS = await svc
    .from("negozi_servizi")
    .insert({ azienda_id: azienda, servizio_codice: "visita", attivo: true });
  if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);

  const { data: srv, error: eSrv } = await svc
    .from("servizi")
    .select("etichetta")
    .eq("codice", "visita")
    .single();
  if (eSrv) throw new Error(`servizio etichetta: ${eSrv.message}`);

  return { slug, etichetta: srv.etichetta as string };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

(haEnv ? test.describe : test.describe.skip)("G7 · Percorso di prenotazione", () => {
  // Mobile: il percorso vive sul telefono, in piedi sul marciapiede.
  test.use({ viewport: { width: 390, height: 844 } });

  let slug = "";
  let etichetta = "";

  test.beforeAll(async () => {
    const n = await creaNegozio();
    slug = n.slug;
    etichetta = n.etichetta;
  });

  test.afterAll(async () => {
    if (!haEnv) return;
    const svc = serviceClient();
    // Best-effort (la prenotazione resta append-only: la delete azienda fallisce).
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

  test("dal QR alla richiesta inviata: 5 passi, codice, testo onesto, fonte qr_vetrina", async ({ page }) => {
    const telefono = telefonoUnico();

    // ── Pagina negozio arrivando dal QR ──────────────────────────────────────
    const resp = await page.goto(`/ottica/${slug}?da=qr`);
    expect(resp?.status(), "la vetrina pubblicata risponde 200").toBe(200);

    // CTA attivo (G7): è un vero link che porta al percorso trascinando ?da=qr.
    const cta = page.getByRole("link", { name: "Prenota un appuntamento" });
    await expect(cta).toHaveAttribute("href", /\/prenota\?da=qr/);
    await cta.click();
    // Il wizard normalizza l'URL a `?passo=1&da=qr`: `da=qr` non è più subito
    // dopo `?`. Basta che il percorso sia /prenota e che `da=qr` ci sia.
    await expect(page).toHaveURL(/\/prenota\?.*da=qr/);

    // ── Passo 1 · che cosa ti serve ──────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Che cosa ti serve?" })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(escapeRe(etichetta)) }).click();

    // ── Passo 2 · copertura sanitaria ────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /copertura sanitaria/i })).toBeVisible();
    await page.getByRole("button", { name: "No", exact: true }).click();

    // ── Passo 3 · chi sei (i campi non hanno label associata: role textbox) ───
    await expect(page.getByRole("heading", { name: "Chi sei?" })).toBeVisible();
    const campi = page.getByRole("textbox");
    await campi.nth(0).fill("Laura Bianchi"); // nome e cognome
    await campi.nth(1).fill(telefono); // telefono
    await page.getByRole("button", { name: "Continua" }).click();

    // ── Passo 4 · quando (vado a domani: giornata intera libera, niente anticipo) ─
    await expect(page.getByRole("heading", { name: "Quando ti va bene?" })).toBeVisible();
    await page.getByRole("button", { name: "Giorno successivo" }).click();
    const primoSlot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await expect(primoSlot).toBeVisible();
    await primoSlot.click();

    // ── Passo 5 · conferma: informativa OBBLIGATORIA ─────────────────────────
    await expect(page.getByRole("heading", { name: "Ci siamo" })).toBeVisible();
    const invia = page.getByRole("button", { name: "Invia la richiesta" });
    await expect(invia, "l'Invia nasce disabilitato finché non si accetta l'informativa").toBeDisabled();

    await page.getByRole("checkbox", { name: /informativa privacy/i }).check();
    await expect(invia, "spuntata l'informativa, l'Invia si abilita").toBeEnabled();
    await invia.click();

    // ── Schermata finale · un CODICE + testo ONESTO ──────────────────────────
    await expect(page.getByText(/Richiesta inviata/i)).toBeVisible();
    const codiceEl = page.getByText(RE_CODICE);
    await expect(codiceEl).toBeVisible();
    const codice = (await codiceEl.textContent())?.trim() ?? "";
    expect(codice).toMatch(RE_CODICE);

    // Onestà: è una RICHIESTA, non una conferma.
    await expect(page.getByText(/non è ancora confermata/i)).toBeVisible();
    await expect(
      page.getByText(/prenotazione confermata/i),
      "la schermata NON deve mai dire «prenotazione confermata»"
    ).toHaveCount(0);

    // ── Verifica a valle nel DB: la fonte del QR ha attraversato tutto ───────
    const svc = serviceClient();
    const { data: pren, error } = await svc
      .from("prenotazioni")
      .select("fonte, stato, contatto_nome, contatto_telefono")
      .eq("codice", codice)
      .single();
    expect(error, error?.message).toBeFalsy();
    expect(pren!.fonte, "la provenienza QR è registrata come qr_vetrina").toBe("qr_vetrina");
    expect(pren!.stato, "una richiesta nasce in_attesa").toBe("in_attesa");
    expect(pren!.contatto_nome).toBe("Laura Bianchi");
    expect(pren!.contatto_telefono).toBe(telefono);
  });
});
