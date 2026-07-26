import type { Fonte } from "@/lib/database.types";

/**
 * `fonte` di una prenotazione dal parametro `da` che il QR porta in coda
 * all'indirizzo (G7). Va trascinato lungo tutto il percorso: se si perde fra un
 * passo e l'altro, la misurazione del funnel (fase 1) diventa inutile.
 *   da=qr → qr_vetrina · da=sito → sito_negozio · assente/altro → portale
 */
export function fonteDaParametro(da: string | null | undefined): Fonte {
  if (da === "qr") return "qr_vetrina";
  if (da === "sito") return "sito_negozio";
  return "portale";
}
