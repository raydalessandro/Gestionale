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
