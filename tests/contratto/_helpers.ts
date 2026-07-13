import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * L2 · Contratto — infrastruttura di test contro un progetto Supabase DEDICATO.
 *
 * REGOLE:
 *  • Mai il progetto di produzione. Le env TEST_SUPABASE_* puntano a
 *    "gestionale-test" (lo crea Ray), con conferma email OFF.
 *  • La service key serve SOLO al setup/teardown (crea utenti, pulisce per
 *    prefisso). Le verifiche vere passano da client anon autenticati con
 *    password: è così che si tocca davvero la RLS.
 *  • Ogni run crea tenant con slug `test-<runid>-…` e li rimuove alla fine.
 */

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

/** True se l'ambiente ha tutte le env per parlare col progetto di test. */
export function haEnv(): boolean {
  return Boolean(URL && ANON && SERVICE);
}

/** Id di run: isola e permette la pulizia per prefisso. */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const PREFISSO_SLUG = `test-${RUN_ID}-`;

/** Client con service role: bypassa la RLS. Solo per setup/teardown. */
export function serviceClient(): SupabaseClient {
  return createClient(URL!, SERVICE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Client anonimo NON autenticato (per verificare i divieti pre-login). */
export function anonClient(): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Tenant = {
  slug: string;
  email: string;
  password: string;
  userId: string;
  aziendaId: string;
  /** Client anon AUTENTICATO come titolare del tenant. */
  cli: SupabaseClient;
};

// Registro per la pulizia: id utenti + slug creati in questo processo.
const utentiCreati: string[] = [];
const slugCreati: string[] = [];

export type Utente = { cli: SupabaseClient; userId: string; email: string; password: string };

/** Slug di test valido (minuscole/numeri/trattini, max 40) per un'etichetta. */
export function slugDiTest(etichetta: string): string {
  return `${PREFISSO_SLUG}${etichetta}`.slice(0, 40).replace(/-$/, "");
}

/**
 * Crea un utente (email confermata) e lo autentica, SENZA onboarding: utile
 * per esercitare la rpc di creazione azienda dai suoi bordi.
 */
export async function creaUtente(etichetta = "u"): Promise<Utente> {
  const svc = serviceClient();
  const email = `${PREFISSO_SLUG}${etichetta}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Password-123!";

  const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: `Utente ${etichetta}` },
  });
  if (eCreate || !creato.user) {
    throw new Error(`createUser fallita: ${eCreate?.message ?? "utente nullo"}`);
  }
  utentiCreati.push(creato.user.id);

  const cli = anonClient();
  const { error: eSignIn } = await cli.auth.signInWithPassword({ email, password });
  if (eSignIn) throw new Error(`signIn fallita: ${eSignIn.message}`);

  return { cli, userId: creato.user.id, email, password };
}

/**
 * Crea un utente, lo autentica e monta l'azienda via la STESSA rpc di
 * onboarding usata dall'app. Ritorna il tenant pronto all'uso.
 */
export async function creaTenant(etichetta = "az"): Promise<Tenant> {
  const u = await creaUtente(etichetta);
  const slug = slugDiTest(etichetta);

  const { data: aziendaId, error: eRpc } = await u.cli.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: `Ottica ${etichetta} ${RUN_ID}`,
    p_slug: slug,
    p_nome_utente: `Titolare ${etichetta}`,
  });
  if (eRpc || !aziendaId) throw new Error(`onboarding fallito: ${eRpc?.message ?? "id nullo"}`);
  slugCreati.push(slug);

  return {
    slug,
    email: u.email,
    password: u.password,
    userId: u.userId,
    aziendaId: aziendaId as string,
    cli: u.cli,
  };
}

/** Prodotto di test dentro il tenant (via il suo client autenticato). */
export async function creaProdotto(
  t: Tenant,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await t.cli
    .from("prodotti")
    .insert({ tipo: "lac", nome: `Prod ${RUN_ID}`, prezzo: 10, ...extra })
    .select("id")
    .single();
  if (error) throw new Error(`creaProdotto: ${error.message}`);
  return data.id as string;
}

/** Cliente di test dentro il tenant. */
export async function creaCliente(t: Tenant, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await t.cli
    .from("clienti")
    .insert({ nome: "Mario", cognome: `Rossi ${RUN_ID}`, ...extra })
    .select("id")
    .single();
  if (error) throw new Error(`creaCliente: ${error.message}`);
  return data.id as string;
}

/**
 * Teardown globale: cancella per prefisso. Cancellare le aziende porta via in
 * cascata clienti/ordini/prodotti/movimenti; poi si rimuovono gli auth users.
 */
export async function pulisci(): Promise<void> {
  if (!haEnv()) return;
  const svc = serviceClient();
  await svc.from("aziende").delete().like("slug", `${PREFISSO_SLUG}%`);
  for (const id of utentiCreati) {
    await svc.auth.admin.deleteUser(id).catch(() => undefined);
  }
  utentiCreati.length = 0;
  slugCreati.length = 0;
}
