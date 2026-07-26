import { describe, it, expect } from "vitest";
import { FONTI } from "@/lib/database.types";
import { ETICHETTE_FONTE } from "@/lib/utils";
import { tintaFonte } from "@/components/ui";

/**
 * L1 · Unit — comportamento del vocabolario `fonte` allargato (fase G3).
 *
 * Complementare alle guardie statiche G12/G12b/G12c (che legano FONTI ↔ check
 * SQL 008 ↔ chiavi delle mappe): qui verifichiamo il *valore reso* dalle due
 * mappe derivate, fonte per fonte, e la tolleranza all'input sconosciuto —
 * il pattern `mappa[x] ?? fallback` su cui i consumatori in app/ contano.
 */

describe("tintaFonte (components/ui.tsx)", () => {
  it("mappa ogni fonte alla tinta attesa del badge", () => {
    const attese: Record<string, string> = {
      banco: "neutro",
      app: "verde",
      convenzione: "ottone",
      import: "neutro",
      qr_vetrina: "ambra",
      sito_negozio: "blu",
      portale: "ambra",
    };
    for (const [fonte, tinta] of Object.entries(attese)) {
      expect(tintaFonte(fonte), `tinta errata per ${fonte}`).toBe(tinta);
    }
  });

  it("copre tutte e sole le fonti del vocabolario (nessuna cade sul fallback)", () => {
    // Ogni fonte di FONTI deve avere una tinta esplicita ≠ dal fallback casuale:
    // se una fonte reale rendesse "neutro" solo perché mancante dalla mappa,
    // non ce ne accorgeremmo qui — perciò controlliamo l'insieme completo.
    for (const f of FONTI) {
      expect(tintaFonte(f), `fonte non mappata: ${f}`).toBeTruthy();
    }
  });

  it("una fonte sconosciuta a runtime cade su 'neutro' (tolleranza)", () => {
    expect(tintaFonte("sito")).toBe("neutro"); // valore ritirato dalla 008
    expect(tintaFonte("piccione")).toBe("neutro");
    expect(tintaFonte("")).toBe("neutro");
  });
});

describe("ETICHETTE_FONTE (lib/utils.ts)", () => {
  it("rende l'etichetta «da banco» attesa per ogni fonte", () => {
    const attese: Record<string, string> = {
      banco: "Banco",
      app: "Dall'app",
      convenzione: "Convenzione",
      import: "Import",
      qr_vetrina: "QR in vetrina",
      sito_negozio: "Sito del negozio",
      portale: "Portale",
    };
    for (const [fonte, etichetta] of Object.entries(attese)) {
      expect(ETICHETTE_FONTE[fonte], `etichetta errata per ${fonte}`).toBe(etichetta);
    }
  });

  it("copre esattamente il vocabolario FONTI, con etichette non vuote", () => {
    for (const f of FONTI) {
      expect(ETICHETTE_FONTE[f], `etichetta mancante per ${f}`).toBeTruthy();
    }
  });

  it("tollera l'accesso con una string sconosciuta (undefined, non lancia)", () => {
    // Il tipo è `Record<Fonte,string> & Record<string,string>`: a runtime una
    // chiave assente rende undefined, così il pattern `ETICHETTE_FONTE[x] ?? x`
    // dei consumatori in app/ regge senza consacrare il valore ritirato 'sito'.
    expect(ETICHETTE_FONTE["sito"]).toBeUndefined();
    expect(ETICHETTE_FONTE["fonte_inesistente"]).toBeUndefined();
  });
});
