/**
 * M5 §4 · Producibilità LAC.
 *
 * Il catalogo descrive una famiglia, non tutte le sue varianti fisiche. Questa
 * funzione valuta soltanto la disponibilità dichiarata dal modello e restituisce
 * avvisi: l'ottico può comunque ordinare o codificare un caso speciale.
 */

export type RegolaStepLac = {
  min: number;
  max: number;
  step: number;
};

export type SchemaProducibilitaLac = {
  sfero?: { regole: RegolaStepLac[] };
  cilindri?: number[];
  assi?: RegolaStepLac;
  addizioni?: number[];
};

export type ParametriProducibilitaLac = {
  sfero?: number | null;
  cilindro?: number | null;
  asse?: number | null;
  addizione?: number | null;
};

export type EsitoProducibilitaLac = {
  producibile: boolean;
  avvisi: string[];
};

const EPSILON = 1e-8;

function coincide(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

function numero(n: number): string {
  return n.toFixed(2);
}

function rispettaStep(valore: number, regola: RegolaStepLac): boolean {
  const passi = (valore - regola.min) / regola.step;
  return coincide(passi, Math.round(passi));
}

function contiene(valore: number, valori: number[]): boolean {
  return valori.some((candidato) => coincide(valore, candidato));
}

/**
 * Valuta una configurazione contro il modello, senza effetti collaterali.
 * `producibile=false` segnala un avviso commerciale; non equivale a un divieto.
 */
export function valutaProducibilitaLac(
  schema: SchemaProducibilitaLac,
  parametri: ParametriProducibilitaLac
): EsitoProducibilitaLac {
  const avvisi: string[] = [];

  if (parametri.sfero != null && schema.sfero?.regole.length) {
    const regola = schema.sfero.regole.find(
      ({ min, max }) => parametri.sfero! >= min - EPSILON && parametri.sfero! <= max + EPSILON
    );
    if (!regola) {
      avvisi.push(`Sfera ${numero(parametri.sfero)} è fuori intervallo.`);
    } else if (!rispettaStep(parametri.sfero, regola)) {
      avvisi.push(`Sfera ${numero(parametri.sfero)} non rispetta lo step disponibile.`);
    }
  }

  if (parametri.cilindro != null && schema.cilindri?.length && !contiene(parametri.cilindro, schema.cilindri)) {
    avvisi.push(`Cilindro ${numero(parametri.cilindro)} non è disponibile per questo modello.`);
  }

  if (parametri.asse != null && schema.assi) {
    if (parametri.asse < schema.assi.min - EPSILON || parametri.asse > schema.assi.max + EPSILON) {
      avvisi.push(`Asse ${parametri.asse} è fuori intervallo.`);
    } else if (!rispettaStep(parametri.asse, schema.assi)) {
      avvisi.push(`Asse ${parametri.asse} non rispetta lo step disponibile.`);
    }
  }

  if (parametri.addizione != null && schema.addizioni?.length && !contiene(parametri.addizione, schema.addizioni)) {
    avvisi.push(`Addizione ${numero(parametri.addizione)} non è disponibile per questo modello.`);
  }

  return { producibile: avvisi.length === 0, avvisi };
}
