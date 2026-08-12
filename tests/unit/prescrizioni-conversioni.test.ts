import { describe, expect, it } from "vitest";
import {
  calcolaIntermedio,
  calcolaOffice,
  calcolaScadenzaProposta,
  compensaDistanzaVertice,
} from "@/lib/prescrizioni-conversioni";

/**
 * M2 §2-bis — Conversioni pure.
 *
 * Sono calcoli di supporto, mai un vincolo clinico: un valore mancante resta
 * mancante e il risultato è sempre sovrascrivibile dall'operatore. La soglia
 * della distanza al vertice è strettamente oltre ±4,00 D.
 */
describe("calcolaScadenzaProposta — proposta modificabile/sticky", () => {
  it.each([
    { visita: "2026-08-12", mesi: 12, attesa: "2027-08-12" },
    { visita: "2026-01-31", mesi: 1, attesa: "2026-02-28" },
    { visita: "2024-02-29", mesi: 12, attesa: "2025-02-28" },
  ])("$visita + $mesi mesi → $attesa", ({ visita, mesi, attesa }) => {
    expect(calcolaScadenzaProposta(visita, mesi)).toBe(attesa);
  });
});

describe("calcolaIntermedio — lontano + ADD/2", () => {
  it.each([
    { lontano: -4, add: 2, atteso: -3 },
    { lontano: 2, add: 2, atteso: 3 },
    { lontano: -5.5, add: 2.5, atteso: -4.25 },
    { lontano: 0, add: 1.5, atteso: 0.75 },
  ])("$lontano + $add/2 = $atteso", ({ lontano, add, atteso }) => {
    expect(calcolaIntermedio(lontano, add)).toBe(atteso);
  });

  it("non inventa un valore quando lontano o ADD manca", () => {
    expect(calcolaIntermedio(null, 2)).toBeNull();
    expect(calcolaIntermedio(-2, null)).toBeNull();
  });
});

describe("calcolaOffice — lontano + ADD, senza intermedio automatico", () => {
  it.each([
    { lontano: -4, add: 2, atteso: -2 },
    { lontano: 2, add: 2, atteso: 4 },
    { lontano: -5.5, add: 2.5, atteso: -3 },
  ])("$lontano + $add = $atteso", ({ lontano, add, atteso }) => {
    expect(calcolaOffice(lontano, add)).toBe(atteso);
  });

  it("non calcola una progressione alternativa quando manca un valore", () => {
    expect(calcolaOffice(null, 2)).toBeNull();
    expect(calcolaOffice(-2, null)).toBeNull();
  });
});

describe("compensaDistanzaVertice — oltre ±4,00 D", () => {
  it.each([
    { potere: -4, atteso: -4, motivo: "soglia negativa inclusa: nessuna compensazione" },
    { potere: 4, atteso: 4, motivo: "soglia positiva inclusa: nessuna compensazione" },
    { potere: -3, atteso: -3, motivo: "entro soglia: nessuna compensazione" },
    { potere: -5.5, atteso: -5.16, motivo: "miopia oltre soglia: compensazione applicata" },
    { potere: 5.5, atteso: 5.89, motivo: "ipermetropia oltre soglia: compensazione applicata" },
  ])("$motivo", ({ potere, atteso }) => {
    expect(compensaDistanzaVertice(potere)).toBe(atteso);
  });

  it("preserva l'assenza del dato", () => {
    expect(compensaDistanzaVertice(null)).toBeNull();
  });

  it("permette una distanza al vertice esplicita senza cambiare la soglia", () => {
    expect(compensaDistanzaVertice(-5.5, 10)).toBe(-5.21);
    expect(compensaDistanzaVertice(4, 10)).toBe(4);
  });
});
