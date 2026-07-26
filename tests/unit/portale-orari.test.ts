import { describe, it, expect } from "vitest";
import {
  raggruppaOrari,
  statoApertura,
  formattaOra,
  dataItaliana,
} from "@/lib/portale/orari";
import type { OrarioPubblicoRow, ChiusuraPubblicaRow } from "@/lib/database.types";

/**
 * L1 · Unit — orari del portale (G5). Funzioni pure: raggruppamento «da persona»
 * e «aperto ora» in ora italiana, con i confini di apertura/chiusura e le ferie.
 * Gli istanti di prova sono UTC; d'estate Roma è UTC+2 (es. 07:00Z = 09:00 a Roma).
 */

const slug = "x";
function o(giorno: number, apre: string, chiude: string): OrarioPubblicoRow {
  return { slug, giorno, apre: `${apre}:00`, chiude: `${chiude}:00` };
}
/** Orario uguale tutti e 7 i giorni: le prove sull'ora non dipendono dal weekday. */
function ogniGiorno(apre: string, chiude: string, apre2?: string, chiude2?: string): OrarioPubblicoRow[] {
  const righe: OrarioPubblicoRow[] = [];
  for (let g = 0; g <= 6; g++) {
    righe.push(o(g, apre, chiude));
    if (apre2 && chiude2) righe.push(o(g, apre2, chiude2));
  }
  return righe;
}

describe("formattaOra", () => {
  it("toglie i secondi e lo zero iniziale dell'ora", () => {
    expect(formattaOra("09:00:00")).toBe("9:00");
    expect(formattaOra("15:30:00")).toBe("15:30");
  });
});

describe("raggruppaOrari — come li legge una persona", () => {
  it("una fascia su un solo giorno aperto", () => {
    const r = raggruppaOrari([o(1, "09", "13")]);
    const lun = r.find((x) => x.giorni === "Lun");
    expect(lun?.orario).toBe("9:00–13:00");
    // gli altri giorni risultano chiusi
    expect(r.some((x) => x.orario === "Chiuso")).toBe(true);
  });

  it("due fasce (pausa pranzo) sullo stesso giorno", () => {
    const righe: OrarioPubblicoRow[] = [
      { slug, giorno: 2, apre: "09:00:00", chiude: "13:00:00" },
      { slug, giorno: 2, apre: "15:00:00", chiude: "19:30:00" },
    ];
    const g = raggruppaOrari(righe).find((x) => x.giorni === "Mar");
    expect(g?.orario).toBe("9:00–13:00 · 15:00–19:30");
  });

  it("giorno senza fasce → «Chiuso»", () => {
    const dom = raggruppaOrari([o(1, "09", "13")]).find((x) => x.giorni.includes("Dom"));
    expect(dom?.orario).toBe("Chiuso");
  });

  it("scenario demo: Lun–Ven con pausa, Sab ridotto, Dom chiuso", () => {
    const righe: OrarioPubblicoRow[] = [];
    for (let g = 1; g <= 5; g++) {
      righe.push({ slug, giorno: g, apre: "09:00:00", chiude: "13:00:00" });
      righe.push({ slug, giorno: g, apre: "15:00:00", chiude: "19:30:00" });
    }
    righe.push({ slug, giorno: 6, apre: "09:00:00", chiude: "12:30:00" });
    const r = raggruppaOrari(righe);
    expect(r).toEqual([
      { giorni: "Lun–Ven", orario: "9:00–13:00 · 15:00–19:30" },
      { giorni: "Sab", orario: "9:00–12:30" },
      { giorni: "Dom", orario: "Chiuso" },
    ]);
  });

  it("tutti i giorni uguali → un'unica riga Lun–Dom", () => {
    const r = raggruppaOrari(ogniGiorno("09", "19"));
    expect(r).toEqual([{ giorni: "Lun–Dom", orario: "9:00–19:00" }]);
  });
});

describe("statoApertura — «aperto ora» in ora di Roma", () => {
  const noChiusure: ChiusuraPubblicaRow[] = [];

  // orari netti: 09:00–13:00 e 15:00–19:30 tutti i giorni
  function orariNetti(): OrarioPubblicoRow[] {
    const righe: OrarioPubblicoRow[] = [];
    for (let g = 0; g <= 6; g++) {
      righe.push({ slug, giorno: g, apre: "09:00:00", chiude: "13:00:00" });
      righe.push({ slug, giorno: g, apre: "15:00:00", chiude: "19:30:00" });
    }
    return righe;
  }

  it("mattina dentro la fascia → aperto", () => {
    // 09:30Z = 11:30 a Roma (estate)
    const s = statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T09:30:00Z"));
    expect(s.aperto).toBe(true);
    expect(s.feriaAlISO).toBeNull();
  });

  it("durante la pausa pranzo → chiuso", () => {
    // 12:00Z = 14:00 a Roma → fra le due fasce
    expect(statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T12:00:00Z")).aperto).toBe(false);
  });

  it("all'istante di apertura è aperto; un minuto prima no (confine)", () => {
    // 07:00Z = 09:00 Roma → apre incluso
    expect(statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T07:00:00Z")).aperto).toBe(true);
    // 06:59Z = 08:59 Roma → ancora chiuso
    expect(statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T06:59:00Z")).aperto).toBe(false);
  });

  it("all'istante di chiusura è già chiuso (confine)", () => {
    // 11:00Z = 13:00 Roma → chiude escluso
    expect(statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T11:00:00Z")).aperto).toBe(false);
    // 10:59Z = 12:59 Roma → ancora aperto
    expect(statoApertura(orariNetti(), noChiusure, new Date("2026-07-13T10:59:00Z")).aperto).toBe(true);
  });

  it("una chiusura per ferie che copre oggi vince su tutto", () => {
    const chiusure: ChiusuraPubblicaRow[] = [{ slug, dal: "2026-07-01", al: "2026-07-20" }];
    const s = statoApertura(orariNetti(), chiusure, new Date("2026-07-13T09:30:00Z"));
    expect(s.aperto).toBe(false);
    expect(s.feriaAlISO).toBe("2026-07-20");
  });

  it("una chiusura passata NON influisce", () => {
    const chiusure: ChiusuraPubblicaRow[] = [{ slug, dal: "2026-06-01", al: "2026-06-10" }];
    expect(statoApertura(orariNetti(), chiusure, new Date("2026-07-13T09:30:00Z")).aperto).toBe(true);
  });
});

describe("dataItaliana", () => {
  it("formatta una data ISO in giorno + mese italiano", () => {
    expect(dataItaliana("2026-08-22")).toBe("22 agosto");
    expect(dataItaliana("2026-01-06")).toBe("6 gennaio");
  });
});
