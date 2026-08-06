/**
 * Codice fiscale — funzioni PURE (nessun I/O, nessuna data «di sistema»
 * implicita: `oggi` si passa, così i test non dipendono dal calendario).
 *
 * Serve alla proposta-tutore di M1 f1a.7: «dal CF si riconosce il minorenne →
 * il sistema PROPONE la scheda tutore (facoltativa)». È una PROPOSTA, non un
 * blocco: davanti a un CF illeggibile non si inventa nulla e non si impedisce
 * niente — si risponde «non lo so» (null) e la scheda si compila lo stesso.
 */

/** Le lettere del mese nel CF, in ordine: A=gennaio … T=dicembre. */
const MESI = "ABCDEHLMPRST";

/** Forma del CF: 6 lettere · 2 cifre (anno) · 1 lettera (mese) · 2 cifre
 *  (giorno, +40 per le donne) · 1 lettera + 3 cifre (comune) · 1 lettera. */
const FORMA = /^[A-Z]{6}\d{2}[ABCDEHLMPRST]\d{2}[A-Z]\d{3}[A-Z]$/;

/**
 * La data di nascita dentro un CF, o `null` se il codice non è leggibile.
 *
 * Il secolo non è nel codice: si sceglie quello che NON cade nel futuro
 * («25» oggi è 1925, non 2025 non ancora avvenuto). `oggi` è un parametro
 * proprio per rendere questa scelta collaudabile.
 */
export function dataNascitaDaCF(cf: string | null | undefined, oggi: Date = new Date()): Date | null {
  if (!cf) return null;
  const c = cf.trim().toUpperCase().replace(/\s/g, "");
  if (!FORMA.test(c)) return null;

  const aa = Number(c.slice(6, 8));
  const mese = MESI.indexOf(c[8]);              // 0-based
  let giorno = Number(c.slice(9, 11));
  if (giorno > 40) giorno -= 40;                // le donne hanno il giorno +40
  if (mese < 0 || giorno < 1 || giorno > 31) return null;

  const secolo = Math.floor(oggi.getFullYear() / 100) * 100;
  let anno = secolo + aa;
  if (anno > oggi.getFullYear()) anno -= 100;   // mai una nascita nel futuro

  const d = new Date(Date.UTC(anno, mese, giorno));
  // Rifiuta le date che non esistono (31 febbraio → 2 o 3 marzo).
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese || d.getUTCDate() !== giorno) return null;
  return d;
}

/**
 * `true` se il CF descrive un minorenne, `false` se maggiorenne,
 * **`null` se non si può dire** (CF mancante o malformato): chi chiama
 * distingue «è minorenne» da «non lo so», e non propone il tutore a caso.
 *
 * Il compimento è il giorno del 18° compleanno: quel giorno si è
 * maggiorenni (non il giorno dopo).
 */
export function eMinorenne(cf: string | null | undefined, oggi: Date = new Date()): boolean | null {
  const nascita = dataNascitaDaCF(cf, oggi);
  if (!nascita) return null;

  const diciottesimo = new Date(Date.UTC(
    nascita.getUTCFullYear() + 18,
    nascita.getUTCMonth(),
    nascita.getUTCDate()
  ));
  // Confronto a giorni pieni: l'ora del giorno non deve spostare il verdetto.
  const oggiUTC = Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate());
  return oggiUTC < diciottesimo.getTime();
}
