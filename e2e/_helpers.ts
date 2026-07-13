import { type Page, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L3 · E2E — utilità condivise.
 *
 * Ogni test crea il SUO tenant usa-e-getta (registrazione+onboarding dalla UI:
 * il primo passo È la registrazione). Nessun test dipende da un altro.
 *
 * Selettori: SOLO ruolo/etichetta/testo (getByRole/getByLabel/getByText). Dove
 * la UI non espone ancora etichette vere (form magazzino: input a solo
 * placeholder, select "nudi") si ripiega su getByPlaceholder/combobox — vedi
 * "ganci richiesti" nel report-test.md.
 *
 * Il SEEDING con service role (sotto) serve SOLO agli scenari che dipendono dal
 * tempo (proposte di richiamo su dati retrodatati), impossibili da produrre a
 * mano dalla UI. Usa le stesse env del L2.
 */

export function unico(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type Tenant = { slug: string; email: string };

/** Registrazione + onboarding dalla UI. Lascia la pagina sulla dashboard. */
export async function registraTenant(page: Page): Promise<Tenant> {
  const id = unico();
  const email = `e2e-${id}@test.local`;
  const password = "Password-123!";
  const nomeNegozio = `Ottica E2E ${id}`; // slug → ottica-e2e-<id> (via slugify)

  await page.goto("/registrati");
  await page.getByLabel("Il tuo nome").fill("Titolare E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Crea account" }).click();

  // Conferma email OFF sul progetto di test → si atterra sull'onboarding.
  await page.waitForURL("**/benvenuto");
  await page.getByLabel("Nome del negozio").fill(nomeNegozio);
  await page.getByRole("button", { name: "Apri il gestionale" }).click();

  await page.waitForURL("**/dashboard");
  const slug = `ottica-e2e-${id}`.slice(0, 40);
  return { slug, email };
}

/** Crea un cliente dalla UI e ritorna il suo id (dall'URL di dettaglio). */
export async function creaCliente(
  page: Page,
  opts: { nome: string; cognome: string; telefono?: string; consensoMarketing?: boolean } = {
    nome: "Laura",
    cognome: "Bianchi",
  }
): Promise<string> {
  await page.goto("/clienti/nuovo");
  // "Cognome" contiene "nome": ancorare con regex esatte.
  await page.getByLabel(/^Nome \*$/).fill(opts.nome);
  await page.getByLabel(/^Cognome \*$/).fill(opts.cognome);
  if (opts.telefono) await page.getByLabel("Telefono").fill(opts.telefono);
  if (opts.consensoMarketing) await page.getByLabel(/Consenso marketing/).check();
  await page.getByRole("button", { name: "Crea cliente" }).click();

  await page.waitForURL(/\/clienti\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

/* ── Seeding via service role (solo scenari temporali) ─────────────────── */

function service(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL!;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function aziendaIdDaSlug(slug: string): Promise<string> {
  const { data, error } = await service().from("aziende").select("id").eq("slug", slug).single();
  if (error) throw new Error(`aziendaIdDaSlug: ${error.message}`);
  return data.id as string;
}

/**
 * Inserisce una busta "pronta", avvisata da >3 giorni: la condizione della
 * proposta ritiro_sollecito (Fase 3 · S3). Ritorna il numero busta.
 */
export async function seedBustaProntaScaduta(
  aziendaId: string,
  clienteId: string
): Promise<string> {
  const svc = service();
  const numero = `BL-SEED-${unico()}`;
  const quattroGgFa = new Date(Date.now() - 4 * 24 * 3600_000).toISOString();
  const { error } = await svc.from("ordini_occhiali").insert({
    azienda_id: aziendaId,
    cliente_id: clienteId,
    numero,
    stato: "pronta",
    totale: 200,
    acconto: 50,
    avvisato_il: quattroGgFa,
  });
  if (error) throw new Error(`seedBustaProntaScaduta: ${error.message}`);
  return numero;
}

/**
 * Inserisce un ordine LAC consegnato ~80 giorni fa: la condizione della
 * proposta lac_esaurimento (Fase 3 · S4, commerciale → soggetta a GDPR).
 */
export async function seedLacConsegnato(aziendaId: string, clienteId: string): Promise<string> {
  const svc = service();
  const numero = `OL-SEED-${unico()}`;
  const ottantaGgFa = new Date(Date.now() - 80 * 24 * 3600_000).toISOString();
  const { error } = await svc.from("ordini_lac").insert({
    azienda_id: aziendaId,
    cliente_id: clienteId,
    numero,
    stato: "consegnato",
    totale: 120,
    data_consegna: ottantaGgFa,
  });
  if (error) throw new Error(`seedLacConsegnato: ${error.message}`);
  return numero;
}

/**
 * Inserisce una busta "pronta" con prezzi di dettaglio e acconto: lo stato di
 * partenza di Fase 4 · S3 (consegna con caparra + doppio incasso). Ritorna id e
 * numero. La busta è avvisata (pronta): il dettaglio mostra "Consegna e incassa"
 * quando il modulo cassa è attivo.
 */
export async function seedBustaProntaConAcconto(
  aziendaId: string,
  clienteId: string,
  opts: { totale: number; acconto: number; prezzoMontatura?: number; prezzoLenti?: number } = {
    totale: 965,
    acconto: 780,
  }
): Promise<{ id: string; numero: string }> {
  const svc = service();
  const numero = `BL-SEED-${unico()}`;
  const { data, error } = await svc
    .from("ordini_occhiali")
    .insert({
      azienda_id: aziendaId,
      cliente_id: clienteId,
      numero,
      stato: "pronta",
      tipo_lavoro: "occhiale_completo",
      totale: opts.totale,
      acconto: opts.acconto,
      prezzo_montatura: opts.prezzoMontatura ?? 0,
      prezzo_lenti: opts.prezzoLenti ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedBustaProntaConAcconto: ${error.message}`);
  return { id: data.id as string, numero };
}

/** Attesa "morbida" su un valore che il server rivaluta (evita sleep fissi). */
export async function attendi(page: Page, cond: () => Promise<boolean>, tent = 20): Promise<void> {
  for (let i = 0; i < tent; i++) {
    if (await cond()) return;
    await page.waitForTimeout(250);
  }
  expect(false, "condizione non raggiunta entro il timeout").toBe(true);
}
