import { describe, it, expect } from "vitest";
import { brandSicuro, coloreValido } from "@/lib/portale/brand";
import { CHIAVI_BRAND } from "@/lib/database.types";

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
