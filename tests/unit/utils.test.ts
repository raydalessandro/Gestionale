import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fmtDiottria,
  fmtRefrazione,
  slugify,
  fmtQuando,
  rxValida,
  scadenzaRx,
} from "@/lib/utils";

/**
 * L1 · Unit — funzioni pure di dominio (lib/utils.ts).
 * Bersagli dai bordi: segno diottrico tipografico, plano/cilindro, accenti,
 * scadenza Rx al limite, tempo relativo. Zero rete, girano sempre.
 */

describe("fmtDiottria", () => {
  it("mette il + esplicito ai positivi", () => {
    expect(fmtDiottria(2)).toBe("+2.00");
    expect(fmtDiottria(0.25)).toBe("+0.25");
  });

  it("usa il meno tipografico (U+2212), non l'ASCII, ai negativi", () => {
    expect(fmtDiottria(-0.5)).toBe("−0.50");
    expect(fmtDiottria(-2)).toBe("−2.00");
    // Difesa esplicita: NON deve essere il trattino ASCII.
    expect(fmtDiottria(-2)).not.toBe("-2.00");
  });

  it("lo zero è 0.00 (né segno né meno)", () => {
    expect(fmtDiottria(0)).toBe("0.00");
  });

  it("null / undefined / NaN diventano trattino lungo", () => {
    expect(fmtDiottria(null)).toBe("—");
    expect(fmtDiottria(undefined)).toBe("—");
    expect(fmtDiottria(NaN)).toBe("—");
  });
});

describe("fmtRefrazione", () => {
  it("sfero e cilindro entrambi assenti → trattino", () => {
    expect(fmtRefrazione(null, null, null)).toBe("—");
  });

  it("sfero 0 → plano", () => {
    expect(fmtRefrazione(0, null, null)).toBe("plano");
  });

  it("solo sfero (cilindro nullo o 0) → solo la sfera", () => {
    expect(fmtRefrazione(-2, null, null)).toBe("−2.00");
    expect(fmtRefrazione(-2, 0, null)).toBe("−2.00");
  });

  it("riga completa con asse e meno tipografico", () => {
    expect(fmtRefrazione(-2, -0.5, 180)).toBe("−2.00 −0.50 × 180°");
  });

  it("plano con cilindro presente e asse mancante → asse 0", () => {
    expect(fmtRefrazione(0, -0.75, null)).toBe("plano −0.75 × 0°");
  });
});

describe("slugify", () => {
  it("minuscole, accenti rimossi, spazi in trattini", () => {
    expect(slugify("Ottica Aurora")).toBe("ottica-aurora");
    expect(slugify("Città è perché")).toBe("citta-e-perche");
  });

  it("niente trattini in testa o in coda, niente doppioni", () => {
    expect(slugify("  Ciao!!!  Mondo  ")).toBe("ciao-mondo");
    expect(slugify("—già—")).toBe("gia");
  });

  it("tronca a 40 caratteri", () => {
    const s = slugify("a".repeat(60));
    expect(s.length).toBe(40);
  });
});

describe("scadenzaRx", () => {
  it("aggiunge validita_mesi alla data visita", () => {
    const scad = scadenzaRx({ data_visita: "2024-01-15", validita_mesi: 12 });
    expect(scad.getFullYear()).toBe(2025);
    expect(scad.getMonth()).toBe(0); // gennaio
    expect(scad.getDate()).toBe(15);
  });

  it("rispetta validità diverse da 12 mesi", () => {
    const scad = scadenzaRx({ data_visita: "2024-01-15", validita_mesi: 6 });
    expect(scad.getMonth()).toBe(6); // luglio
  });
});

describe("rxValida", () => {
  const oggi = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it("non attiva → mai valida, anche se recente", () => {
    expect(
      rxValida({ attiva: false, data_visita: iso(oggi), validita_mesi: 12 })
    ).toBe(false);
  });

  it("attiva e non scaduta → valida", () => {
    const seiMesiFa = new Date(oggi);
    seiMesiFa.setMonth(seiMesiFa.getMonth() - 6);
    expect(
      rxValida({ attiva: true, data_visita: iso(seiMesiFa), validita_mesi: 12 })
    ).toBe(true);
  });

  it("attiva ma oltre la scadenza → non valida", () => {
    const dueAnniFa = new Date(oggi);
    dueAnniFa.setFullYear(dueAnniFa.getFullYear() - 2);
    expect(
      rxValida({ attiva: true, data_visita: iso(dueAnniFa), validita_mesi: 12 })
    ).toBe(false);
  });

  it("al bordo: istante di scadenza == adesso è ancora valido (>=)", () => {
    // scadenzaRx lavora a mezzanotte: fissiamo "adesso" all'istante esatto di
    // scadenza per esercitare il confronto >= senza dipendere dall'ora del run.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-13T00:00:00.000Z"));
    expect(
      rxValida({ attiva: true, data_visita: "2024-07-13", validita_mesi: 12 })
    ).toBe(true);
    // un istante dopo la scadenza → non più valida
    vi.setSystemTime(new Date("2025-07-13T00:00:00.001Z"));
    expect(
      rxValida({ attiva: true, data_visita: "2024-07-13", validita_mesi: 12 })
    ).toBe(false);
    vi.useRealTimers();
  });
});

describe("fmtQuando", () => {
  afterEach(() => vi.useRealTimers());

  const base = new Date("2026-07-13T12:00:00Z");
  const primaDi = (ms: number) => new Date(base.getTime() - ms).toISOString();

  function conOra<T>(fn: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(base);
    return fn();
  }

  it("nullo → trattino", () => {
    expect(fmtQuando(null)).toBe("—");
    expect(fmtQuando(undefined)).toBe("—");
  });

  it("meno di un minuto → adesso", () => {
    conOra(() => expect(fmtQuando(primaDi(30_000))).toBe("adesso"));
  });

  it("minuti", () => {
    conOra(() => expect(fmtQuando(primaDi(5 * 60_000))).toBe("5 min fa"));
  });

  it("ore, con singolare/plurale", () => {
    conOra(() => expect(fmtQuando(primaDi(1 * 3600_000))).toBe("1 ora fa"));
    conOra(() => expect(fmtQuando(primaDi(3 * 3600_000))).toBe("3 ore fa"));
  });

  it("ieri e giorni fa", () => {
    conOra(() => expect(fmtQuando(primaDi(24 * 3600_000))).toBe("ieri"));
    conOra(() => expect(fmtQuando(primaDi(4 * 24 * 3600_000))).toBe("4 gg fa"));
  });

  it("oltre 30 giorni → cade sulla data formattata (non 'gg fa')", () => {
    conOra(() => {
      const out = fmtQuando(primaDi(60 * 24 * 3600_000));
      expect(out).not.toContain("gg fa");
      expect(out).not.toBe("—");
    });
  });
});
