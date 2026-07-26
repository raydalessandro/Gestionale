import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — G4 · Pagina pubblica del negozio (/ottica/[slug]).
 *
 * I 4 casi della consegna:
 *  1. anonimo su uno slug PUBBLICATO → 200 con il nome del negozio a video;
 *  2. anonimo su uno slug INESISTENTE → 404;
 *  3. anonimo su un negozio con portale_attivo=false → 404 (spento = non esiste
 *     per il pubblico, senza toccarne i dati);
 *  4. anonimo su /dashboard → redirect a /login. È il caso che conta di più:
 *     dimostra che aprire il portale NON ha aperto il gestionale.
 *
 * I negozi 1 e 3 vanno seminati nel DB di TEST col service role (setup/teardown),
 * perché il loro stato (portale_attivo, nome_pubblico) non è producibile dalla UI
 * pubblica. Ogni run usa slug unici col RUN_ID e ripulisce per prefisso. NON si
 * dipende dallo slug statico `ottica-demo` del seed: potrebbe non esserci nel test.
 *
 * Guardia d'ambiente: senza le env TEST_SUPABASE_* la suite si auto-salta (come il
 * L2), così girare Playwright in locale senza progetto di test non la fa fallire.
 */

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const haEnv = Boolean(URL && ANON && SERVICE);

// Id di run: isola gli slug e permette la pulizia per prefisso.
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

// Registro per il teardown: id auth-user creati in questo processo.
const utentiCreati: string[] = [];

type Negozio = { slug: string; nomePubblico: string };

/**
 * Crea un negozio di test tramite la STESSA rpc di onboarding dell'app (serve un
 * utente autenticato: auth.uid() non è null col service role), poi ne imposta lo
 * stato di vetrina col service role. Ritorna slug e nome pubblico attesi a video.
 */
async function creaNegozio(
  etichetta: string,
  opts: { attivo: boolean; nomePubblico: string; tagline?: string }
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

  // Stato di vetrina: portale_attivo + nome_pubblico (+tagline) direttamente su aziende.
  const { error: eUpd } = await svc
    .from("aziende")
    .update({
      portale_attivo: opts.attivo,
      nome_pubblico: opts.nomePubblico,
      tagline: opts.tagline ?? null,
    })
    .eq("id", aziendaId as string);
  if (eUpd) throw new Error(`update vetrina fallita: ${eUpd.message}`);

  return { slug, nomePubblico: opts.nomePubblico };
}

let pubblicato: Negozio;
let spento: Negozio;

// (haEnv ? describe : describe.skip): senza env i test si registrano ma non girano,
// e i beforeAll/afterAll (che parlano col DB) NON vengono eseguiti.
(haEnv ? test.describe : test.describe.skip)("G4 · Pagina pubblica del negozio", () => {
  test.beforeAll(async () => {
    pubblicato = await creaNegozio("pub", {
      attivo: true,
      nomePubblico: `Ottica Pubblica ${RUN_ID}`,
      tagline: "La tua vista, la nostra cura",
    });
    spento = await creaNegozio("off", {
      attivo: false,
      nomePubblico: `Ottica Spenta ${RUN_ID}`,
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

  test("1 · anonimo su uno slug pubblicato → 200 col nome del negozio a video", async ({ page }) => {
    const resp = await page.goto(`/ottica/${pubblicato.slug}`);
    expect(resp?.status(), "la vetrina pubblicata deve rispondere 200").toBe(200);
    // Il nome è il titolo (h1) della pagina: selettore per ruolo/testo, mai CSS.
    await expect(
      page.getByRole("heading", { name: pubblicato.nomePubblico })
    ).toBeVisible();
  });

  test("2 · anonimo su uno slug inesistente → 404", async ({ page }) => {
    const resp = await page.goto(`/ottica/non-esiste-${RUN_ID}`);
    expect(resp?.status(), "uno slug inesistente deve dare 404").toBe(404);
  });

  test("3 · anonimo su un negozio con portale_attivo=false → 404", async ({ page }) => {
    const resp = await page.goto(`/ottica/${spento.slug}`);
    expect(resp?.status(), "un negozio spento non esiste per il pubblico → 404").toBe(404);
    // E il suo nome NON deve trapelare a video.
    await expect(page.getByText(spento.nomePubblico)).toHaveCount(0);
  });

  test("4 · anonimo su /dashboard → redirect a /login (il portale non apre il gestionale)", async ({ page }) => {
    await page.goto("/dashboard");
    // Il middleware rimanda al login (con ?da=/dashboard); Playwright segue il redirect.
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
