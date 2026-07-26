import { clientPubblico } from "@/lib/portale/negozio";

/**
 * Slot liberi del portale (G6). Il calcolo vive in `slot_liberi` (SQL, security
 * definer): è l'unico modo perché l'anonimo ottenga gli orari liberi senza
 * leggere appuntamenti/prenotazioni/blocchi, che gli sono revocati. Qui la
 * chiamiamo via RPC con lo stesso client ANON della vetrina — nessun service role.
 */
export async function slotLiberi(
  slug: string,
  servizio: string,
  giornoISO: string
): Promise<string[]> {
  const { data, error } = await clientPubblico().rpc("slot_liberi", {
    p_slug: slug,
    p_servizio: servizio,
    p_giorno: giornoISO,
  });
  if (error || !data) return [];
  // setof timestamptz → array di ISO string.
  return data as string[];
}
