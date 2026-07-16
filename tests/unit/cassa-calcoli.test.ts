import { describe, it, expect } from "vitest";
import {
  sistemaPerMetodo,
  caparreSenzaMetodo,
  contantiAttesi,
  contatoriCaparre,
  NOME_CAPARRA,
  type VenditaCalc,
  type ResoDenaroCalc,
  type AccontoCalc,
} from "@/lib/cassa-calcoli";

/**
 * L1 · Unit — la QUADRATURA di cassa (lib/cassa-calcoli.ts, Fase 4c).
 *
 * È il cuore dell'audit A1/A3: una sola formula pura, usata identica dalla
 * chiusura serale e dai "contanti attesi" della homepage. Qui la esercitiamo
 * ai bordi che contano davvero: l'esclusione della voce 'Caparra' (le caparre
 * scalate NON sono denaro del giorno), gli acconti aggiunti col loro metodo,
 * i resi in denaro sottratti per metodo, i quattro contatori, il valore
 * informativo "senza metodo", i contanti attesi. Zero rete, gira sempre.
 */

/** Vendita helper: costruisce il campo `pagamenti` (jsonb) da coppie nome/importo. */
function vendita(...pagamenti: { nome: string; importo: number }[]): VenditaCalc {
  return { pagamenti };
}

describe("sistemaPerMetodo", () => {
  it("nessun movimento → mappa vuota", () => {
    expect(sistemaPerMetodo([], [], []).size).toBe(0);
  });

  it("somma i pagamenti delle vendite per metodo (più circuiti sulla stessa vendita)", () => {
    const m = sistemaPerMetodo(
      [vendita({ nome: "Contanti", importo: 40 }, { nome: "Carte", importo: 60 })],
      [],
      []
    );
    expect(m.get("Contanti")).toBe(40);
    expect(m.get("Carte")).toBe(60);
  });

  it("aggrega lo stesso metodo su vendite diverse", () => {
    const m = sistemaPerMetodo(
      [vendita({ nome: "Contanti", importo: 30 }), vendita({ nome: "Contanti", importo: 12.5 })],
      [],
      []
    );
    expect(m.get("Contanti")).toBe(42.5);
  });

  it("ESCLUDE la voce 'Caparra' (scalata, non denaro del giorno) — case-insensitive", () => {
    const m = sistemaPerMetodo(
      [
        vendita(
          { nome: "Contanti", importo: 100 },
          { nome: "Caparra", importo: 50 },
          { nome: "caparra", importo: 20 },
          { nome: "CAPARRA", importo: 5 }
        ),
      ],
      [],
      []
    );
    expect(m.get("Contanti")).toBe(100);
    expect(m.has("Caparra")).toBe(false);
    expect(m.has("caparra")).toBe(false);
    // il nome riservato è la costante esportata, in minuscolo
    expect(NOME_CAPARRA).toBe("caparra");
  });

  it("AGGIUNGE gli acconti incassati oggi col loro metodo (>0 e metodo presente)", () => {
    const acconti: AccontoCalc[] = [
      { acconto: 50, acconto_metodo: "Mastercard" },
      { acconto: 30, acconto_metodo: "Contanti" },
      { acconto: 0, acconto_metodo: "Contanti" }, // 0 → ignorato
      { acconto: 99, acconto_metodo: null }, // senza metodo → non entra qui
    ];
    const m = sistemaPerMetodo([], [], acconti);
    expect(m.get("Mastercard")).toBe(50);
    expect(m.get("Contanti")).toBe(30);
    expect(m.has("null")).toBe(false);
  });

  it("SOTTRAE i resi in denaro del giorno per metodo di rimborso", () => {
    const m = sistemaPerMetodo(
      [vendita({ nome: "Contanti", importo: 100 }, { nome: "Carte", importo: 100 })],
      [
        { metodo_rimborso: "Contanti", importo: 30 },
        { metodo_rimborso: "Carte", importo: 10 },
      ],
      []
    );
    expect(m.get("Contanti")).toBe(70);
    expect(m.get("Carte")).toBe(90);
  });

  it("un reso senza metodo di rimborso ricade sui Contanti", () => {
    const m = sistemaPerMetodo([], [{ metodo_rimborso: null, importo: 25 }], []);
    expect(m.get("Contanti")).toBe(-25);
  });

  it("combina vendite + acconti − resi sullo stesso metodo, arrotondando al centesimo", () => {
    const m = sistemaPerMetodo(
      [vendita({ nome: "Contanti", importo: 0.1 }, { nome: "Contanti", importo: 0.2 })],
      [{ metodo_rimborso: "Contanti", importo: 0.05 }],
      [{ acconto: 0.05, acconto_metodo: "Contanti" }]
    );
    // 0.1 + 0.2 − 0.05 + 0.05 = 0.30 (senza sbavature in virgola mobile)
    expect(m.get("Contanti")).toBe(0.3);
  });

  it("è robusta a pagamenti non-array (jsonb sporco) → li tratta come vuoti", () => {
    const m = sistemaPerMetodo([{ pagamenti: null }, { pagamenti: "x" }], [], []);
    expect(m.size).toBe(0);
  });
});

describe("caparreSenzaMetodo", () => {
  it("somma solo gli acconti >0 SENZA metodo (buste col backfill 007)", () => {
    const tot = caparreSenzaMetodo([
      { acconto: 100, acconto_metodo: null },
      { acconto: 50, acconto_metodo: "Contanti" }, // ha metodo → escluso
      { acconto: 0, acconto_metodo: null }, // 0 → escluso
      { acconto: 20.5, acconto_metodo: "" }, // "" falsy → conta come senza metodo
    ]);
    expect(tot).toBe(120.5);
  });

  it("nessuna caparra orfana → 0", () => {
    expect(caparreSenzaMetodo([{ acconto: 40, acconto_metodo: "Carte" }])).toBe(0);
    expect(caparreSenzaMetodo([])).toBe(0);
  });
});

describe("contantiAttesi", () => {
  it("fondo + sistema('Contanti') − prelievi/spese", () => {
    const sistema = new Map<string, number>([
      ["Contanti", 250],
      ["Carte", 999],
    ]);
    expect(contantiAttesi(300, sistema, 40)).toBe(510);
  });

  it("se non ci sono contanti di sistema, resta fondo − prelievi", () => {
    expect(contantiAttesi(300, new Map(), 20)).toBe(280);
  });

  it("arrotonda al centesimo", () => {
    const sistema = new Map<string, number>([["Contanti", 0.1]]);
    expect(contantiAttesi(0.2, sistema, 0)).toBe(0.3);
  });
});

describe("contatoriCaparre (i quattro contatori del report di catena)", () => {
  it("emesse/scontate/rese/incamerate calcolati indipendentemente", () => {
    const c = contatoriCaparre({
      accontiEmessiOggi: [{ acconto: 100 }, { acconto: 50 }, { acconto: null as unknown as number }],
      venditeOggi: [
        vendita({ nome: "Contanti", importo: 150 }, { nome: "Caparra", importo: 100 }),
        vendita({ nome: "caparra", importo: 30 }),
      ],
      resiCaparraOggi: [{ importo: 100 }, { importo: 20 }],
      incameriOggi: [{ importo: 50 }],
    });
    expect(c.emesse).toBe(150); // 100 + 50 (null → 0)
    expect(c.scontate).toBe(130); // 100 + 30 (case-insensitive), i non-Caparra ignorati
    expect(c.rese).toBe(120); // 100 + 20
    expect(c.incamerate).toBe(50);
  });

  it("giornata senza caparre → tutti a zero", () => {
    const c = contatoriCaparre({
      accontiEmessiOggi: [],
      venditeOggi: [vendita({ nome: "Contanti", importo: 80 })],
      resiCaparraOggi: [],
      incameriOggi: [],
    });
    expect(c).toEqual({ emesse: 0, scontate: 0, rese: 0, incamerate: 0 });
  });

  it("le caparre scontate contano SOLO la voce 'Caparra', non gli altri metodi", () => {
    const c = contatoriCaparre({
      accontiEmessiOggi: [],
      venditeOggi: [vendita({ nome: "Contanti", importo: 200 }, { nome: "Carte", importo: 50 })],
      resiCaparraOggi: [],
      incameriOggi: [],
    });
    expect(c.scontate).toBe(0);
  });
});
