import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — G5 · Orari, servizi e leggibilità della testata (/ottica/[slug]).
 *
 * I casi della consegna:
 *  1. un negozio pubblicato con orari a FASCE (stesse fasce Lun–Ven) e 2+ servizi
 *     mostra a video gli ORARI RAGGRUPPATI (intervallo di giorni "Lun–Ven") e
 *     almeno un nome di servizio;
 *  2. un negozio con brand.primary CHIARO (#F0E4CE) mostra il TITOLO (h1) in
 *     inchiostro Limpidia scuro rgb(23,21,18); il controapaio: primary SCURO →
 *     titolo bianco rgb(255,255,255). Il contrasto è aritmetica (WCAG), non tema.
 *
 * Come il L2 e il g4: setup/teardown col service role (orari/servizi/brand non
 * sono producibili dalla UI pubblica), slug unici per RUN_ID, guardia d'ambiente
 * che auto-salta la suite senza le env TEST_SUPABASE_*.
 */

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const haEnv = Boolean(URL && ANON && SERVICE);

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFISSO_SLUG = `test-${RUN_ID}-`;

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

type OrarioSeed = { giorno: number; apre: string; chiude: string };
type ServizioSeed = { codice: string; attivo?: boolean };
type Negozio = { slug: string; nomePubblico: string };

/**
 * Crea un negozio via la STESSA rpc di onboarding dell'app (serve un utente
 * autenticato), poi imposta col service role la vetrina (portale_attivo, nome,
 * brand) e semina orari/servizi. Ritorna slug e nome pubblico attesi a video.
 */
async function creaNegozio(
  etichetta: string,
  opts: {
    nomePubblico: string;
    brand?: Record<string, string>;
    orari?: OrarioSeed[];
    servizi?: ServizioSeed[];
  }
): Promise<Negozio> {
  const svc = serviceClient();
  const email = `${PREFISSO_SLUG}${etichetta}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Password-123!";

  const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: `Titolare ${etichetta}` },
  });
  if (eCreate || !creato.user) {
    throw new Error(`createUser fallita: ${eCreate?.message ?? "utente nullo"}`);
  }
  utentiCreati.push(creato.user.id);

  const cli = anonClient();
  const { error: eSignIn } = await cli.auth.signInWithPassword({ email, password });
  if (eSignIn) throw new Error(`signIn fallita: ${eSignIn.message}`);

  const slug = `${PREFISSO_SLUG}${etichetta}`.slice(0, 40).replace(/-$/, "");
  const { data: aziendaId, error: eRpc } = await cli.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: `Ottica ${etichetta} ${RUN_ID}`,
    p_slug: slug,
    p_nome_utente: `Titolare ${etichetta}`,
  });
  if (eRpc || !aziendaId) throw new Error(`onboarding fallito: ${eRpc?.message ?? "id nullo"}`);
  const azienda = aziendaId as string;

  const { error: eUpd } = await svc
    .from("aziende")
    .update({
      portale_attivo: true,
      nome_pubblico: opts.nomePubblico,
      ...(opts.brand ? { brand: opts.brand } : {}),
    })
    .eq("id", azienda);
  if (eUpd) throw new Error(`update vetrina fallita: ${eUpd.message}`);

  if (opts.orari?.length) {
    const { error } = await svc
      .from("orari_apertura")
      .insert(opts.orari.map((o) => ({ azienda_id: azienda, ...o })));
    if (error) throw new Error(`seed orari fallito: ${error.message}`);
  }

  if (opts.servizi?.length) {
    const { error } = await svc.from("negozi_servizi").insert(
      opts.servizi.map((s) => ({
        azienda_id: azienda,
        servizio_codice: s.codice,
        attivo: s.attivo ?? true,
      }))
    );
    if (error) throw new Error(`seed servizi fallito: ${error.message}`);
  }

  return { slug, nomePubblico: opts.nomePubblico };
}

// Stessa fascia dal lunedì (1) al venerdì (5): raggruppa in "Lun–Ven".
const FASCE_LUN_VEN: OrarioSeed[] = [1, 2, 3, 4, 5].map((giorno) => ({
  giorno,
  apre: "09:00",
  chiude: "13:00",
}));

let conOrari: Negozio;
let testataChiara: Negozio;
let testataScura: Negozio;

(haEnv ? test.describe : test.describe.skip)("G5 · Orari, servizi e testata", () => {
  test.beforeAll(async () => {
    conOrari = await creaNegozio("orari", {
      nomePubblico: `Ottica Orari ${RUN_ID}`,
      orari: FASCE_LUN_VEN,
      servizi: [{ codice: "visita" }, { codice: "occhiale" }],
    });
    testataChiara = await creaNegozio("chiara", {
      nomePubblico: `Ottica Chiara ${RUN_ID}`,
      brand: { primary: "#F0E4CE" }, // beige chiaro → testo inchiostro
    });
    testataScura = await creaNegozio("scura", {
      nomePubblico: `Ottica Scura ${RUN_ID}`,
      brand: { primary: "#171512" }, // inchiostro → testo bianco
    });
  });

  test.afterAll(async () => {
    if (!haEnv) return;
    const svc = serviceClient();
    await svc.from("aziende").delete().like("slug", `${PREFISSO_SLUG}%`);
    for (const id of utentiCreati) {
      await svc.auth.admin.deleteUser(id).catch(() => undefined);
    }
    utentiCreati.length = 0;
  });

  test("1 · orari a fasce → gli orari sono raggruppati (Lun–Ven) e un servizio è a video", async ({
    page,
  }) => {
    const resp = await page.goto(`/ottica/${conOrari.slug}`);
    expect(resp?.status(), "la vetrina pubblicata deve rispondere 200").toBe(200);

    // I giorni con le stesse fasce si fondono in un intervallo: "Lun–Ven".
    // Il separatore è un trattino tipografico (en-dash): il "." del regex lo copre.
    await expect(page.getByText(/Lun.Ven/).first()).toBeVisible();

    // Almeno un nome di servizio dal catalogo globale (etichetta di "visita").
    await expect(page.getByText("Visita optometrica").first()).toBeVisible();
  });

  test("2 · brand primary CHIARO → titolo in inchiostro scuro rgb(23, 21, 18)", async ({
    page,
  }) => {
    await page.goto(`/ottica/${testataChiara.slug}`);
    const titolo = page.getByRole("heading", { name: testataChiara.nomePubblico });
    await expect(titolo).toBeVisible();
    // #171512 = rgb(23, 21, 18): l'inchiostro Limpidia, non il bianco.
    await expect(titolo).toHaveCSS("color", "rgb(23, 21, 18)");
  });

  test("2b · brand primary SCURO → titolo in bianco rgb(255, 255, 255)", async ({ page }) => {
    await page.goto(`/ottica/${testataScura.slug}`);
    const titolo = page.getByRole("heading", { name: testataScura.nomePubblico });
    await expect(titolo).toBeVisible();
    await expect(titolo).toHaveCSS("color", "rgb(255, 255, 255)");
  });
});
