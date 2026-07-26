import {
  CHIAVI_BRAND,
  type BrandGrezzo,
  type BrandNegozio,
  type ChiaveBrand,
} from "@/lib/database.types";

/**
 * Validazione del brand del negozio — confine di sicurezza (G4 · punto 6).
 *
 * `aziende.brand` è un jsonb CONTROLLATO DAL TENANT e i suoi valori finiscono
 * dentro attributi `style`/`--var` della pagina pubblica: un valore malevolo lì
 * dentro è un'iniezione CSS. Qui accettiamo SOLO colori esadecimali nella forma
 * `#RGB` o `#RRGGBB`; qualunque altra cosa (stringa arbitraria, `url(...)`,
 * `expression(...)`, numero, oggetto, mancante) ricade sul colore Limpidia
 * corrispondente. Il valore grezzo del DB non passa MAI dentro `style`.
 */

/** Colori Limpidia di ripiego, uno per chiave del brand. */
const FALLBACK: BrandNegozio = {
  primary: "#171512", // inchiostro
  accent: "#B4551A", // ambra
  accentSoft: "#F6E8DE",
  surface: "#F2F2F0", // carta
  textSoft: "#6E6A64",
  textFaint: "#8B877F",
};

/** Espressione stretta: solo `#` seguito da 3 o 6 cifre esadecimali, nient'altro. */
const COLORE_ESADECIMALE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True se `v` è una stringa colore esadecimale valida e nient'altro. */
export function coloreValido(v: unknown): v is string {
  return typeof v === "string" && COLORE_ESADECIMALE.test(v);
}

/**
 * Ritorna un brand SICURO: per ogni chiave, il colore del DB se è un esadecimale
 * valido, altrimenti il colore Limpidia di ripiego. Mai il valore grezzo.
 */
export function brandSicuro(grezzo: BrandGrezzo | null | undefined): BrandNegozio {
  const out = {} as BrandNegozio;
  for (const chiave of CHIAVI_BRAND) {
    const valore = grezzo?.[chiave as ChiaveBrand];
    out[chiave] = coloreValido(valore) ? valore : FALLBACK[chiave];
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Leggibilità della testata (G5) — aritmetica, non estetica.
 * La testata è testo sopra `brand.primary`. Un'insegna chiara (beige, avorio,
 * azzurro pastello) con testo bianco fisso dà una pagina illeggibile davanti al
 * cliente. Qui si sceglie il testo per contrasto, con la formula WCAG standard.
 * ──────────────────────────────────────────────────────────────────────────── */

const INCHIOSTRO = "#171512";
const BIANCO = "#FFFFFF";

/** "#RGB"/"#RRGGBB" → [r,g,b] in 0–255. Assume input già validato (coloreValido). */
function canali(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Correzione gamma di un canale normalizzato 0–1, secondo WCAG. */
function linearizza(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminanza relativa (0–1) secondo WCAG 2.x, da un colore già validato. */
export function luminanza(hex: string): number {
  const [r, g, b] = canali(hex).map((v) => linearizza(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto WCAG fra due colori: (Lchiaro+0.05)/(Lscuro+0.05). */
export function contrasto(a: string, b: string): number {
  const la = luminanza(a);
  const lb = luminanza(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Il colore di testo leggibile sopra `fondo`: inchiostro Limpidia o bianco,
 * quello col rapporto di contrasto più alto. Su un fondo chiaro vince
 * l'inchiostro, su uno scuro il bianco.
 */
export function testoSuFondo(fondo: string): typeof INCHIOSTRO | typeof BIANCO {
  return contrasto(fondo, INCHIOSTRO) >= contrasto(fondo, BIANCO) ? INCHIOSTRO : BIANCO;
}
