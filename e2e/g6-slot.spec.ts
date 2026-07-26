import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — G6 · La griglia degli slot su /ottica/[slug].
 *
 * I casi della consegna:
 *  1. un negozio pubblicato con orari e un servizio: `?servizio=<codice>&giorno=<F>`
 *     mostra la GRIGLIA degli orari liberi (le celle 09:00 … 12:30);
 *  2. cambiando il servizio (link, navigazione server) cambiano gli ORARI: per
 *     un servizio da 45' l'ultimo slot valido è 12:15, non 12:30;
 *  3. un giorno coperto da una chiusura per ferie mostra «Nessun orario libero»;
 *  4. la pagina non ha componenti client: i controlli (servizio, giorno) sono
 *     `<a href>` veri e navigano lato server — click = cambio URL.
 *
 * La pagina è un server component che calcola gli slot via la rpc `slot_liberi`
 * (011) con la chiave anon: il progetto Supabase di TEST deve avere la 011
 * applicata. Setup/teardown col service role (orari/servizi/chiusure non sono
 * producibili dalla UI pubblica). Slug unici per RUN_ID, guardia d'ambiente.
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

// Date di parete a Roma: F ha orari (giorno futuro), Gferie è in chiusura.
function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
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

const OGGI = oggiRomaISO();
const F = piuGiorni(OGGI, 7); // giorno con orari (grid piena)
const G_FERIE = piuGiorni(OGGI, 14); // giorno coperto da chiusura

let slug = "";

/**
 * Crea un negozio pubblicato via la STESSA rpc di onboarding dell'app, poi
 * semina col service role: orari tutti i giorni 09–13, i due servizi (visita 30',
 * occhiale 45' dal catalogo) e una chiusura per ferie su G_FERIE.
 */
async function creaNegozioConSlot(): Promise<string> {
  const svc = serviceClient();
  const email = `${PREFISSO_SLUG}slot-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Password-123!";

  const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Titolare slot" },
  });
  if (eCreate || !creato.user) throw new Error(`createUser fallita: ${eCreate?.message ?? "utente nullo"}`);
  utentiCreati.push(creato.user.id);

  const cli = anonClient();
  const { error: eSignIn } = await cli.auth.signInWithPassword({ email, password });
  if (eSignIn) throw new Error(`signIn fallita: ${eSignIn.message}`);

  const s = `${PREFISSO_SLUG}slot`.slice(0, 40).replace(/-$/, "");
  const { data: aziendaId, error: eRpc } = await cli.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: `Ottica Slot ${RUN_ID}`,
    p_slug: s,
    p_nome_utente: "Titolare slot",
  });
  if (eRpc || !aziendaId) throw new Error(`onboarding fallito: ${eRpc?.message ?? "id nullo"}`);
  const azienda = aziendaId as string;

  const { error: eUpd } = await svc
    .from("aziende")
    .update({ portale_attivo: true, nome_pubblico: `Ottica Slot ${RUN_ID}` })
    .eq("id", azienda);
  if (eUpd) throw new Error(`update vetrina fallita: ${eUpd.message}`);

  // Aperto tutti i giorni 09–13: F ha sempre orari, qualunque sia il suo weekday.
  const orari = [0, 1, 2, 3, 4, 5, 6].map((giorno) => ({
    azienda_id: azienda,
    giorno,
    apre: "09:00",
    chiude: "13:00",
  }));
  const eO = await svc.from("orari_apertura").insert(orari);
  if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);

  // visita (30' dal catalogo) e occhiale (45'): durate diverse → grid diversa.
  const eS = await svc.from("negozi_servizi").insert([
    { azienda_id: azienda, servizio_codice: "visita", attivo: true },
    { azienda_id: azienda, servizio_codice: "occhiale", attivo: true },
  ]);
  if (eS.error) throw new Error(`seed servizi: ${eS.error.message}`);

  const eC = await svc
    .from("chiusure")
    .insert({ azienda_id: azienda, dal: G_FERIE, al: G_FERIE, motivo: "Ferie di prova" });
  if (eC.error) throw new Error(`seed chiusura: ${eC.error.message}`);

  return s;
}

(haEnv ? test.describe : test.describe.skip)("G6 · Griglia degli slot", () => {
  test.beforeAll(async () => {
    slug = await creaNegozioConSlot();
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

  test("1 · servizio scelto → la griglia mostra gli orari liberi (09:00 … 12:30)", async ({ page }) => {
    const resp = await page.goto(`/ottica/${slug}?servizio=visita&giorno=${F}`);
    expect(resp?.status(), "la vetrina pubblicata deve rispondere 200").toBe(200);

    // La sezione di prenotazione e le celle degli slot (servizio 30' → fino a 12:30).
    await expect(page.getByText("Prenota un servizio")).toBeVisible();
    await expect(page.getByText("09:00", { exact: true })).toBeVisible();
    await expect(page.getByText("12:30", { exact: true })).toBeVisible();
  });

  test("2 · cambiando servizio (link, server) cambiano gli orari: 45' → ultimo 12:15", async ({ page }) => {
    await page.goto(`/ottica/${slug}?servizio=visita&giorno=${F}`);
    // il controllo del servizio è un vero link, non un bottone JS
    const linkOcchiale = page.getByRole("link", { name: "Occhiale da vista" });
    await expect(linkOcchiale).toHaveAttribute("href", /servizio=occhiale/);

    await linkOcchiale.click();
    await expect(page).toHaveURL(/servizio=occhiale/);
    // 45' su 09–13: l'ultimo inizio valido è 12:15 (12:15+45=13:00), non 12:30.
    await expect(page.getByText("12:15", { exact: true })).toBeVisible();
    await expect(page.getByText("12:30", { exact: true })).toHaveCount(0);
  });

  test("3 · giorno in ferie → «Nessun orario libero»", async ({ page }) => {
    await page.goto(`/ottica/${slug}?servizio=visita&giorno=${G_FERIE}`);
    await expect(page.getByText(/Nessun orario libero/)).toBeVisible();
    // niente celle di slot in un giorno chiuso
    await expect(page.getByText("09:00", { exact: true })).toHaveCount(0);
  });

  test("4 · nessun componente client: i controlli sono link che navigano lato server", async ({ page }) => {
    await page.goto(`/ottica/${slug}?servizio=visita&giorno=${F}`);
    // la navigazione al giorno successivo è un <a href>, non un onClick JS
    const avanti = page.getByRole("link", { name: "Giorno successivo" });
    await expect(avanti).toHaveAttribute("href", /giorno=/);
    await avanti.click();
    // l'URL cambia giorno (server navigation): non resta su F
    await expect(page).not.toHaveURL(new RegExp(`giorno=${F}`));
    await expect(page).toHaveURL(/servizio=visita/);
  });
});
