import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type {
  NegozioPubblicoRow,
  OrarioPubblicoRow,
  ChiusuraPubblicaRow,
  ServizioPubblicoRow,
} from "@/lib/database.types";

/**
 * Lettura dei dati di vetrina del portale (G4 · punto 5).
 *
 * REGOLA: si legge SOLO la vista `negozi_pubblici`, con un client ANONIMO
 * (chiave anon), SENZA sessione. Se la pagina funziona così, DB-02 è dimostrata
 * sul campo: l'anonimo vede la vetrina e nient'altro. Il service role qui non
 * deve comparire — se servisse, qualcosa è sbagliato e va segnalato, non aggirato.
 */

/** Client anonimo e stateless: nessun cookie, nessuna sessione. Solo la vetrina. */
export function clientPubblico() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Il negozio pubblicato con questo slug, o `null` se non esiste o non è
 * pubblicato (la vista filtra già `portale_attivo = true`, quindi un negozio
 * spento semplicemente non compare).
 */
export async function negozioDaSlug(slug: string): Promise<NegozioPubblicoRow | null> {
  const anon = clientPubblico();
  const { data, error } = await anon
    .from("negozi_pubblici")
    .select("slug, nome_pubblico, tagline, logo_url, indirizzo, citta, cap, provincia, brand")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as NegozioPubblicoRow;
}

/** Orari di apertura del negozio (dalla vista pubblica), ordinati per giorno/apertura. */
export async function orariDaSlug(slug: string): Promise<OrarioPubblicoRow[]> {
  const { data, error } = await clientPubblico()
    .from("orari_pubblici")
    .select("slug, giorno, apre, chiude")
    .eq("slug", slug);
  if (error || !data) return [];
  return data as OrarioPubblicoRow[];
}

/** Chiusure (ferie/festività) del negozio, dalla vista pubblica (senza motivo). */
export async function chiusureDaSlug(slug: string): Promise<ChiusuraPubblicaRow[]> {
  const { data, error } = await clientPubblico()
    .from("chiusure_pubbliche")
    .select("slug, dal, al")
    .eq("slug", slug);
  if (error || !data) return [];
  return data as ChiusuraPubblicaRow[];
}

/** Servizi attivi del negozio, dalla vista pubblica, nell'ordine del catalogo. */
export async function serviziDaSlug(slug: string): Promise<ServizioPubblicoRow[]> {
  const { data, error } = await clientPubblico()
    .from("servizi_pubblici")
    .select("slug, codice, etichetta, durata_minuti, ordine")
    .eq("slug", slug)
    .order("ordine", { ascending: true });
  if (error || !data) return [];
  return data as ServizioPubblicoRow[];
}
