import { describe, it, expect } from "vitest";
import {
  canaleEsitoDaPreferito,
  CANALI_RICHIAMO,
  ETICHETTE_CANALE_PREFERITO,
  ETICHETTE_RUOLO,
} from "@/lib/utils";

/**
 * L1 · Unit — helper anagrafiche (Fase 4b / migrazione 006).
 * `canaleEsitoDaPreferito` è pura: mappa il canale preferito del cliente al
 * canale precompilato nell'esito richiamo, ma solo se è un canale di contatto
 * valido (il 'cartaceo' NON è un canale di richiamo → stringa vuota).
 */

describe("canaleEsitoDaPreferito", () => {
  it("i canali di contatto validi passano invariati", () => {
    for (const c of ["telefono", "whatsapp", "sms", "email"]) {
      expect(canaleEsitoDaPreferito(c)).toBe(c);
      // coerenza: ogni canale accettato esiste anche fra i CANALI_RICHIAMO
      expect(c in CANALI_RICHIAMO).toBe(true);
    }
  });

  it("'cartaceo' è un canale preferito ma NON un canale di richiamo → vuoto", () => {
    // è nelle etichette del canale preferito...
    expect("cartaceo" in ETICHETTE_CANALE_PREFERITO).toBe(true);
    // ...ma non è un canale di richiamo, quindi non precompila nulla
    expect("cartaceo" in CANALI_RICHIAMO).toBe(false);
    expect(canaleEsitoDaPreferito("cartaceo")).toBe("");
  });

  it("null / undefined / valore ignoto → vuoto (nessuna precompilazione)", () => {
    expect(canaleEsitoDaPreferito(null)).toBe("");
    expect(canaleEsitoDaPreferito(undefined)).toBe("");
    expect(canaleEsitoDaPreferito("piccione")).toBe("");
  });
});

describe("vocabolari 006 (coerenza col contratto)", () => {
  it("ETICHETTE_CANALE_PREFERITO copre esattamente la lista del check DB", () => {
    // migrazione 006: canale_preferito in ('telefono','whatsapp','sms','email','cartaceo')
    expect(Object.keys(ETICHETTE_CANALE_PREFERITO).sort()).toEqual(
      ["cartaceo", "email", "sms", "telefono", "whatsapp"].sort()
    );
  });

  it("ETICHETTE_RUOLO copre esattamente il vocabolario ruoli 006", () => {
    // migrazione 006: ruolo in ('titolare','responsabile','ottico','addetto')
    expect(Object.keys(ETICHETTE_RUOLO).sort()).toEqual(
      ["addetto", "ottico", "responsabile", "titolare"].sort()
    );
  });
});
