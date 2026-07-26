import { describe, it, expect } from "vitest";
import {
  brandSicuro,
  coloreValido,
  luminanza,
  contrasto,
  testoSuFondo,
} from "@/lib/portale/brand";
import { CHIAVI_BRAND } from "@/lib/database.types";

const INCHIOSTRO = "#171512";
const BIANCO = "#FFFFFF";

/**
 * L1 · Unit — validazione del brand del portale (confine di sicurezza G4).
 * `aziende.brand` è controllato dal tenant e finisce in attributi di stile: un
 * valore non-colore è un tentativo di iniezione CSS e deve cadere sul ripiego.
 */

describe("coloreValido — accetta SOLO #RGB / #RRGGBB", () => {
  it("accetta esadecimali validi", () => {
    for (const c of ["#000", "#fff", "#FFF", "#1F5C56", "#e08a3c", "#ABCDEF"]) {
      expect(coloreValido(c), c).toBe(true);
    }
  });

  it("respinge tutto il resto (iniezioni, formati diversi, non-stringhe)", () => {
    const cattivi = [
      "red",
      "#12",
      "#1234",
      "#12345",
      "#1234567",
      "#GGG",
      "rgb(0,0,0)",
      "url(https://x/y.png)",
      "expression(alert(1))",
      "#000; background:url(x)",
      "#000000 } body{display:none",
      "",
      " #000000",
      "#000000 ",
      123 as unknown,
      null as unknown,
      undefined as unknown,
      {} as unknown,
    ];
    for (const c of cattivi) {
      expect(coloreValido(c), String(c)).toBe(false);
    }
  });
});

describe("brandSicuro — completa e disinfetta", () => {
  it("tiene i colori validi e riempie ogni chiave mancante col ripiego Limpidia", () => {
    const b = brandSicuro({ primary: "#1F5C56", accent: "non-un-colore" });
    // chiave valida tenuta
    expect(b.primary).toBe("#1F5C56");
    // chiave invalida → ripiego (ambra Limpidia)
    expect(b.accent).toBe("#B4551A");
    // tutte le chiavi presenti, tutte colori validi
    for (const k of CHIAVI_BRAND) {
      expect(coloreValido(b[k]), `chiave ${k} non è un colore valido`).toBe(true);
    }
  });

  it("brand null/vuoto → tutto ripiego, nessun valore grezzo passa", () => {
    for (const grezzo of [null, undefined, {}]) {
      const b = brandSicuro(grezzo as never);
      for (const k of CHIAVI_BRAND) expect(coloreValido(b[k])).toBe(true);
    }
  });

  it("un payload di iniezione non sopravvive mai nel risultato", () => {
    const veleno = "#000; background:url(//evil)";
    const b = brandSicuro({ primary: veleno, surface: veleno });
    expect(b.primary).not.toContain("url");
    expect(b.surface).not.toContain("url");
    expect(coloreValido(b.primary)).toBe(true);
    expect(coloreValido(b.surface)).toBe(true);
  });
});

/**
 * L1 · Unit — contrasto della testata (G5). È aritmetica WCAG, non estetica:
 * il testo si sceglie per leggibilità sul colore dell'insegna.
 */
describe("luminanza / contrasto (WCAG)", () => {
  it("nero ≈ 0, bianco ≈ 1", () => {
    expect(luminanza("#000000")).toBeCloseTo(0, 5);
    expect(luminanza("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("il rapporto bianco/nero è 21:1 (il massimo)", () => {
    expect(contrasto("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("il rapporto è simmetrico", () => {
    expect(contrasto("#1F5C56", "#FFFFFF")).toBeCloseTo(contrasto("#FFFFFF", "#1F5C56"), 6);
  });
});

describe("testoSuFondo — sceglie inchiostro o bianco per contrasto", () => {
  it("nero → testo bianco", () => {
    expect(testoSuFondo("#000000")).toBe(BIANCO);
  });
  it("bianco → testo inchiostro", () => {
    expect(testoSuFondo("#FFFFFF")).toBe(INCHIOSTRO);
  });
  it("un beige chiaro (#F5E9D0) → testo inchiostro", () => {
    expect(testoSuFondo("#F5E9D0")).toBe(INCHIOSTRO);
  });
  it("un verde scuro d'insegna (#1F5C56) → testo bianco", () => {
    expect(testoSuFondo("#1F5C56")).toBe(BIANCO);
  });

  it("per fondi diversi il testo scelto supera sempre 4,5:1", () => {
    // Include i due negozi demo (scuro e chiaro) e altri estremi.
    for (const fondo of ["#000000", "#FFFFFF", "#F5E9D0", "#1F5C56", "#F0E4CE", "#93430F"]) {
      const testo = testoSuFondo(fondo);
      expect(contrasto(fondo, testo), `contrasto insufficiente su ${fondo}`).toBeGreaterThan(4.5);
    }
  });
});
