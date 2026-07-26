import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — G5-bis · Contrasto della testata su DATI VERI (/ottica/[slug]).
 *
 * L'unico caso — ma è quello che conta della consegna «Allineamento dei dati
 * dimostrativi»: aperte in SEQUENZA due pagine negozio del portale, il nome del
 * negozio (l'h1 in testata) deve risultare
 *   • CHIARO (bianco) su un negozio con brand.primary SCURO;
 *   • SCURO (inchiostro) su un negozio con brand.primary CHIARO.
 * È la prova automatica che `testoSuFondo` (contrasto WCAG, lib/portale/brand.ts)
 * sceglie l'inchiostro o il bianco per leggibilità, non per tema — verificata su
 * negozi seminati come quelli reali, non su costanti di test.
 *
 * Come g4/g5: setup/teardown col service role (brand e portale_attivo non sono
 * producibili dalla UI pubblica), slug unici per RUN_ID, guardia d'ambiente che
 * auto-salta la suite senza le env TEST_SUPABASE_*. La CI deve avere la
 * migrazione 010 (aziende.brand + viste pubbliche) applicata al progetto di test.
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

type Negozio = { slug: string; nomePubblico: string };

/**
 * Crea un negozio via la STESSA rpc di onboarding dell'app (serve un utente
 * autenticato: auth.uid() non è null col service role), poi ne imposta col
 * service role la vetrina: portale_attivo + nome_pubblico + brand. Ritorna slug
 * e nome pubblico attesi come titolo (h1) a video.
 */
async function creaNegozio(
  etichetta: string,
  opts: { nomePubblico: string; brand: Record<string, string> }
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

  const { error: eUpd } = await svc
    .from("aziende")
    .update({
      portale_attivo: true,
      nome_pubblico: opts.nomePubblico,
      brand: opts.brand,
    })
    .eq("id", aziendaId as string);
  if (eUpd) throw new Error(`update vetrina fallita: ${eUpd.message}`);

  return { slug, nomePubblico: opts.nomePubblico };
}

let scuro: Negozio;
let chiaro: Negozio;

(haEnv ? test.describe : test.describe.skip)("G5-bis · Contrasto della testata su dati veri", () => {
  test.beforeAll(async () => {
    // primary SCURO → il contrasto vince col bianco.
    scuro = await creaNegozio("scuro", {
      nomePubblico: `Ottica Notturna ${RUN_ID}`,
      brand: { primary: "#243447" }, // blu profondo
    });
    // primary CHIARO → il contrasto vince con l'inchiostro.
    chiaro = await creaNegozio("chiaro", {
      nomePubblico: `Ottica Avorio ${RUN_ID}`,
      brand: { primary: "#F0E6D2" }, // avorio
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

  test("le due testate: bianco sul negozio scuro, inchiostro sul negozio chiaro", async ({
    page,
  }) => {
    // 1) Negozio con primary SCURO → h1 in bianco rgb(255, 255, 255).
    await page.goto(`/ottica/${scuro.slug}`);
    const titoloScuro = page.getByRole("heading", { name: scuro.nomePubblico });
    await expect(titoloScuro).toBeVisible();
    await expect(titoloScuro).toHaveCSS("color", "rgb(255, 255, 255)");

    // 2) Negozio con primary CHIARO → h1 in inchiostro rgb(23, 21, 18).
    await page.goto(`/ottica/${chiaro.slug}`);
    const titoloChiaro = page.getByRole("heading", { name: chiaro.nomePubblico });
    await expect(titoloChiaro).toBeVisible();
    await expect(titoloChiaro).toHaveCSS("color", "rgb(23, 21, 18)");
  });
});
