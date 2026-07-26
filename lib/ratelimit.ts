/**
 * Limite di frequenza (ST-04) — pattern copiato da Impero, NON importato come
 * dipendenza. Prima barriera anti-spam sulla scrittura pubblica del portale.
 *
 * ⚠️ LIMITE NOTO: lo stato vive nel processo. Su un runtime a più istanze
 * (serverless) ogni istanza ha il suo contatore → il limite è PER-ISTANZA, non
 * globale. È una prima difesa; quella forte contro i doppioni è la
 * `chiave_richiesta` idempotente lato DB. Prima del go-live valutare un limite
 * CONDIVISO (Redis/DB) — vedi docs/fasi/fase-g7-prenota.md.
 */

export type Finestra = { max: number; finestraMs: number };

// Soglie (costanti, commentate). Per IP più generose (dietro NAT/wifi condiviso
// più persone escono dallo stesso IP); per telefono più strette (una persona
// non prenota molte volte di fila).
export const LIMITE_IP: Finestra = { max: 8, finestraMs: 10 * 60_000 }; //  8 richieste / 10 min per IP
export const LIMITE_TELEFONO: Finestra = { max: 3, finestraMs: 60 * 60_000 }; // 3 richieste / ora per telefono

const storeGlobale = new Map<string, number[]>(); // chiave → timestamp (ms) dei tentativi

export type EsitoLimite = { ok: boolean; chiaveScattata?: string };

/**
 * Registra un tentativo e dice se è entro i limiti. `now` e `store` sono
 * iniettabili per i test. Verifica TUTTE le chiavi prima di registrare, così un
 * blocco su una chiave non consuma il budget dell'altra.
 */
export function controllaLimite(
  chiavi: { ip?: string | null; telefono?: string | null },
  now: number = Date.now(),
  store: Map<string, number[]> = storeGlobale
): EsitoLimite {
  const controlli: [string, Finestra][] = [];
  if (chiavi.ip) controlli.push([`ip:${chiavi.ip}`, LIMITE_IP]);
  if (chiavi.telefono) controlli.push([`tel:${chiavi.telefono}`, LIMITE_TELEFONO]);

  for (const [chiave, lim] of controlli) {
    const recenti = (store.get(chiave) ?? []).filter((t) => now - t < lim.finestraMs);
    if (recenti.length >= lim.max) return { ok: false, chiaveScattata: chiave };
  }
  for (const [chiave, lim] of controlli) {
    const recenti = (store.get(chiave) ?? []).filter((t) => now - t < lim.finestraMs);
    recenti.push(now);
    store.set(chiave, recenti);
  }
  return { ok: true };
}

/** Azzera lo store globale (solo per i test). */
export function azzeraLimite(): void {
  storeGlobale.clear();
}
