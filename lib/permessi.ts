/**
 * L'helper dei permessi — contratto C2 (`docs/fasi/contratti-B1.md`).
 *
 * REGOLA: l'enforcement sta NELL'AZIONE. La UI che nasconde un bottone è
 * cortesia, mai sicurezza — una chiamata diretta (API, script, curl) passa da
 * qui esattamente come un click.
 *
 * FONTE: `docs/regole/permessi.json`, importato al BUILD (mai letto a runtime
 * da fonti mutabili). La matrice è POLICY di piattaforma: si cambia lì e ha
 * effetto senza migrazioni (M10 S5).
 *
 * FAIL CLOSED: se qualcosa non torna, si NEGA. Mai «provo». In particolare un
 * permesso non presente in matrice è NEGATO, non permesso: i permessi nuovi
 * non nascono aperti.
 *
 * Le azioni NON leggono mai `permessi.json` da sole: chiamano `richiedi()`.
 */

import matriceRegole from "@/docs/regole/permessi.json";
import { createClient } from "@/lib/supabase/server";

/* ── Vocabolario ───────────────────────────────────────────────────── */

export type Ruolo = "titolare" | "responsabile" | "ottico" | "addetto";

/** I motivi del diniego — uno per riga della tabella C2. */
export type MotivoNegato =
  | "non_autenticato"
  | "profilo_mancante"
  | "utente_disattivato"
  | "ruolo_sconosciuto"
  | "permesso_inesistente"
  | "non_autorizzato"
  | "policy_non_disponibile"
  | "tenant_violato";

/** Il contesto VERIFICATO che l'azione riceve: ogni query filtra su questo. */
export interface ContestoVerificato {
  utente_id: string;
  azienda_id: string;
  ruolo: Ruolo;
}

/** Lanciata da `richiedi`. Il `motivo` è la riga di C2 che ha negato. */
export class PermessoNegato extends Error {
  readonly motivo: MotivoNegato;
  constructor(motivo: MotivoNegato, dettaglio?: string) {
    super(dettaglio ? `${motivo}: ${dettaglio}` : motivo);
    this.name = "PermessoNegato";
    this.motivo = motivo;
  }
}

/* ── La matrice ────────────────────────────────────────────────────── */

export interface Matrice {
  ruoli: string[];
  matrice: Record<string, Record<string, unknown>>;
}

/** Il profilo grezzo letto da `utenti` (o null se non c'è). */
export interface ProfiloGrezzo {
  id: string;
  azienda_id: string;
  ruolo: string;
  attivo: boolean;
}

export type Esito =
  | { ok: true; contesto: ContestoVerificato }
  | { ok: false; motivo: MotivoNegato };

/**
 * Il CUORE, puro e senza effetti: dato un permesso, il profilo (o null) e la
 * matrice (o null se il caricamento è fallito), decide. Separato da `richiedi`
 * perché la tabella C2 si collauda riga per riga senza database né sessione.
 *
 * L'ordine dei controlli È quello della tabella C2 e non va cambiato: il primo
 * motivo che scatta è quello che si riporta.
 */
export function valutaPermesso(
  permesso: string,
  profilo: ProfiloGrezzo | null,
  matrice: Matrice | null,
  autenticato: boolean
): Esito {
  // C2 · policy illeggibile → si nega tutto (e chi guarda i log lo scopre).
  if (!matrice || !matrice.matrice) return { ok: false, motivo: "policy_non_disponibile" };

  // C2 · nessuna sessione.
  if (!autenticato) return { ok: false, motivo: "non_autenticato" };

  // C2 · autenticato ma senza riga in `utenti`.
  if (!profilo) return { ok: false, motivo: "profilo_mancante" };

  // C2 · profilo disattivato.
  if (!profilo.attivo) return { ok: false, motivo: "utente_disattivato" };

  // C2 · ruolo che la policy non conosce.
  if (!matrice.ruoli.includes(profilo.ruolo)) return { ok: false, motivo: "ruolo_sconosciuto" };

  // C2 · permesso assente dalla matrice → NEGATO (mai default-allow).
  const riga = Object.prototype.hasOwnProperty.call(matrice.matrice, permesso)
    ? matrice.matrice[permesso]
    : undefined;
  if (!riga) return { ok: false, motivo: "permesso_inesistente" };

  // C2 · la casella deve valere ESATTAMENTE true (non "truthy").
  if (riga[profilo.ruolo] !== true) return { ok: false, motivo: "non_autorizzato" };

  return {
    ok: true,
    contesto: {
      utente_id: profilo.id,
      azienda_id: profilo.azienda_id,
      ruolo: profilo.ruolo as Ruolo,
    },
  };
}

/** La matrice caricata dal build. Se il file fosse malformato, resta null e
 *  `valutaPermesso` nega tutto con `policy_non_disponibile`. */
function caricaMatrice(): Matrice | null {
  try {
    const m = matriceRegole as unknown as Matrice;
    if (!m || !Array.isArray(m.ruoli) || typeof m.matrice !== "object") return null;
    return m;
  } catch {
    return null;
  }
}

/* ── L'uso nelle azioni ────────────────────────────────────────────── */

/**
 * Da chiamare IN TESTA a ogni server action. Ritorna il contesto verificato
 * (con l'`azienda_id` su cui l'azione DEVE filtrare ogni query) oppure lancia
 * `PermessoNegato`.
 */
export async function richiedi(permesso: string): Promise<ContestoVerificato> {
  const matrice = caricaMatrice();
  if (!matrice) {
    // Allarme: la policy è il cancello, se non si legge lo si dice forte.
    console.error("[permessi] policy non disponibile: docs/regole/permessi.json illeggibile o malformato");
    throw new PermessoNegato("policy_non_disponibile");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profilo: ProfiloGrezzo | null = null;
  if (user) {
    const { data } = await supabase
      .from("utenti")
      .select("id, azienda_id, ruolo, attivo")
      .eq("id", user.id)
      .maybeSingle();
    profilo = (data as ProfiloGrezzo | null) ?? null;
  }

  const esito = valutaPermesso(permesso, profilo, matrice, Boolean(user));
  if (!esito.ok) throw new PermessoNegato(esito.motivo);
  return esito.contesto;
}

/**
 * Il pezzo TENANT del contratto: una risorsa di un'altra azienda non esiste,
 * per chi chiede. Da usare dopo aver letto una riga che porta `azienda_id`.
 */
export function assicuraTenant(
  contesto: ContestoVerificato,
  aziendaDellaRisorsa: string | null | undefined
): void {
  if (!aziendaDellaRisorsa || aziendaDellaRisorsa !== contesto.azienda_id) {
    throw new PermessoNegato("tenant_violato");
  }
}

/** Messaggi da banco: il diniego si dice con garbo (M10 S1). */
export const MESSAGGIO_NEGATO: Record<MotivoNegato, string> = {
  non_autenticato: "Sessione scaduta: rifai il login.",
  profilo_mancante: "Profilo non trovato: rifai il login.",
  utente_disattivato: "Questo profilo è disattivato: chiedi al titolare.",
  ruolo_sconosciuto: "Ruolo non riconosciuto: chiedi al titolare.",
  permesso_inesistente: "Questa operazione non è prevista.",
  non_autorizzato: "Per questa operazione serve il titolare o il responsabile.",
  policy_non_disponibile: "Controllo dei permessi non disponibile: riprova.",
  tenant_violato: "Elemento non trovato.",
};

/** Traduce l'eccezione in `{errore}`, la forma che le azioni già ritornano. */
export function esitoDaErrore(e: unknown): { errore: string } {
  if (e instanceof PermessoNegato) return { errore: MESSAGGIO_NEGATO[e.motivo] };
  return { errore: e instanceof Error ? e.message : "Operazione non riuscita." };
}
