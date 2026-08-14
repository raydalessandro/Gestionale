import { describe, expect, it } from "vitest";
import {
  valutaProducibilitaLac,
  type SchemaProducibilitaLac,
} from "@/lib/lac-producibilita";

/**
 * M5 §4 e §7 — Producibilità LAC pura.
 *
 * La funzione informa l’ottico ma non blocca mai la scrittura: i casi fuori
 * catalogo restano possibili previo confronto con il fornitore. Il suo output
 * è pertanto un insieme di avvisi, non un gate clinico o commerciale.
 */
const schema: SchemaProducibilitaLac = {
  sfero: {
    regole: [
      { min: -12, max: -6.5, step: 0.5 },
      { min: -6, max: 6, step: 0.25 },
    ],
  },
  cilindri: [-0.75, -1.25, -1.75, -2.25],
  assi: { min: 0, max: 180, step: 10 },
  addizioni: [1, 1.5, 2, 2.5],
};

describe("valutaProducibilitaLac — avviso puro, mai blocco", () => {
  it.each([
    { sfero: -2.25, motivo: "step 0,25 nel tratto centrale" },
    { sfero: -7.5, motivo: "step 0,50 nel tratto alto" },
    { sfero: 6, motivo: "limite superiore incluso" },
    { sfero: -12, motivo: "limite inferiore incluso" },
  ])("accetta $motivo", ({ sfero }) => {
    expect(valutaProducibilitaLac(schema, { sfero })).toEqual({ producibile: true, avvisi: [] });
  });

  it.each([
    { sfero: -2.1, atteso: "Sfera -2.10 non rispetta lo step disponibile." },
    { sfero: -7.25, atteso: "Sfera -7.25 non rispetta lo step disponibile." },
    { sfero: 6.25, atteso: "Sfera 6.25 è fuori intervallo." },
    { sfero: -12.5, atteso: "Sfera -12.50 è fuori intervallo." },
  ])("segnala $sfero senza bloccare", ({ sfero, atteso }) => {
    const esito = valutaProducibilitaLac(schema, { sfero });
    expect(esito.producibile).toBe(false);
    expect(esito.avvisi).toContain(atteso);
  });

  it("controlla cilindro, asse e addizione quando sono presenti", () => {
    expect(
      valutaProducibilitaLac(schema, { sfero: -2, cilindro: -1.25, asse: 90, addizione: 2 })
    ).toEqual({ producibile: true, avvisi: [] });

    expect(valutaProducibilitaLac(schema, { sfero: -2, cilindro: -0.5, asse: 85, addizione: 3 }))
      .toEqual({
        producibile: false,
        avvisi: [
          "Cilindro -0.50 non è disponibile per questo modello.",
          "Asse 85 non rispetta lo step disponibile.",
          "Addizione 3.00 non è disponibile per questo modello.",
        ],
      });
  });

  it("non inventa un avviso per parametri assenti o non configurati", () => {
    expect(valutaProducibilitaLac(schema, { sfero: -2 })).toEqual({ producibile: true, avvisi: [] });
    expect(valutaProducibilitaLac({}, { sfero: -20, cilindro: -9, asse: 7, addizione: 5 })).toEqual({
      producibile: true,
      avvisi: [],
    });
  });
});
