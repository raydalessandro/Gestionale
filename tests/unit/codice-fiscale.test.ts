import { describe, it, expect } from "vitest";
import { dataNascitaDaCF, eMinorenne } from "@/lib/codice-fiscale";

/**
 * L1 · TDD unit — `lib/codice-fiscale.ts` (M1 f1a.7: «dal CF si riconosce il
 * minorenne → il sistema PROPONE la scheda tutore»).
 *
 * Le due regole che questi test difendono:
 *  1. la PROPOSTA non è un blocco: davanti a un codice illeggibile la risposta è
 *     `null` = «non lo so», MAI `false` (che vorrebbe dire «è maggiorenne» e
 *     nasconderebbe la proposta tutore a un minore con CF scritto male);
 *  2. il verdetto non dipende dal calendario di chi esegue i test: `oggi` si
 *     passa SEMPRE esplicito, altrimenti il test del 18° compleanno scadrebbe.
 *
 * Anatomia del CF usata qui: 6 lettere · 2 cifre (anno) · 1 lettera (mese, dalla
 * serie ABCDEHLMPRST) · 2 cifre (giorno, +40 per le donne) · 1 lettera + 3 cifre
 * (comune) · 1 carattere di controllo. I codici sono INVENTATI (forma valida, il
 * carattere di controllo non viene verificato dalla funzione).
 */

/** Una data UTC, per confronti senza fuso. */
const utc = (a: number, m: number, g: number) => new Date(Date.UTC(a, m - 1, g));
/** Formato leggibile nelle asserzioni. */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Riferimento fisso per i test che non parlano di compleanni.
const OGGI = utc(2026, 8, 6);

describe("dataNascitaDaCF · l'estrazione", () => {
  it("CF maschile: il giorno si legge com'è (M = agosto)", () => {
    // RSSMRA85M01H501Z → 1 agosto 1985. 'M' è l'ottava lettera di ABCDEHLMPRST.
    expect(iso(dataNascitaDaCF("RSSMRA85M01H501Z", OGGI))).toBe("1985-08-01");
  });

  it("CF femminile: il giorno è +40 e va riportato indietro", () => {
    // BNCLRA85M41H501Z → 41 − 40 = 1 agosto 1985: stessa data del maschile.
    expect(iso(dataNascitaDaCF("BNCLRA85M41H501Z", OGGI))).toBe("1985-08-01");
    // Il 31 del mese, donna, è 71.
    expect(iso(dataNascitaDaCF("BNCLRA85E71H501Z", OGGI))).toBe("1985-05-31");
  });

  it("le dodici lettere dei mesi mappano gennaio→dicembre nell'ordine ABCDEHLMPRST", () => {
    const attesi = [
      ["A", "1990-01-15"],
      ["B", "1990-02-15"],
      ["C", "1990-03-15"],
      ["D", "1990-04-15"],
      ["E", "1990-05-15"],
      ["H", "1990-06-15"],
      ["L", "1990-07-15"],
      ["M", "1990-08-15"],
      ["P", "1990-09-15"],
      ["R", "1990-10-15"],
      ["S", "1990-11-15"],
      ["T", "1990-12-15"],
    ] as const;
    for (const [lettera, data] of attesi) {
      expect(iso(dataNascitaDaCF(`RSSMRA90${lettera}15H501Z`, OGGI)), `mese ${lettera}`).toBe(data);
    }
    // Una lettera FUORI serie (I, N, O, Q…) non è un mese: codice illeggibile.
    for (const lettera of ["I", "N", "O", "Q", "F", "G"]) {
      expect(dataNascitaDaCF(`RSSMRA90${lettera}15H501Z`, OGGI), `«${lettera}» non è un mese`).toBeNull();
    }
  });

  it("tollera minuscole e spazi (si normalizza prima di leggere)", () => {
    expect(iso(dataNascitaDaCF("rssmra85m01h501z", OGGI))).toBe("1985-08-01");
    expect(iso(dataNascitaDaCF("  RSS MRA 85M01 H501Z ", OGGI))).toBe("1985-08-01");
  });

  /* ── «Non lo so» → null ──────────────────────────────────────────────── */

  it("CF mancante, vuoto o malformato → null (non una data inventata)", () => {
    expect(dataNascitaDaCF(null, OGGI)).toBeNull();
    expect(dataNascitaDaCF(undefined, OGGI)).toBeNull();
    expect(dataNascitaDaCF("", OGGI)).toBeNull();
    expect(dataNascitaDaCF("   ", OGGI)).toBeNull();
    expect(dataNascitaDaCF("RSSMRA85M01H501", OGGI), "15 caratteri").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85M01H501ZZ", OGGI), "17 caratteri").toBeNull();
    expect(dataNascitaDaCF("RSSMR185M01H501Z", OGGI), "cifra fra le prime 6 lettere").toBeNull();
    expect(dataNascitaDaCF("Mario Rossi", OGGI)).toBeNull();
    expect(dataNascitaDaCF("0000000000000000", OGGI), "tutto cifre").toBeNull();
  });

  it("data inesistente (31 febbraio) → null, non il 2/3 marzo", () => {
    // Il 31 febbraio ESISTE come stringa ma non come giorno: Date lo farebbe
    // scivolare a marzo. La funzione deve accorgersene e dire «non lo so».
    expect(dataNascitaDaCF("RSSMRA85B31H501Z", OGGI), "31 febbraio, uomo").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85B71H501Z", OGGI), "31 febbraio, donna (71)").toBeNull();
    // Il 29 febbraio di un anno NON bisestile idem; in un bisestile invece esiste.
    expect(dataNascitaDaCF("RSSMRA85B29H501Z", OGGI), "29/02/1985 non esiste").toBeNull();
    expect(iso(dataNascitaDaCF("RSSMRA84B29H501Z", OGGI)), "29/02/1984 esiste").toBe("1984-02-29");
    // 31 aprile e 31 novembre: mesi da 30 giorni.
    expect(dataNascitaDaCF("RSSMRA85D31H501Z", OGGI), "31 aprile").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85S31H501Z", OGGI), "31 novembre").toBeNull();
  });

  it("giorni fuori scala (00, 32-40, 72+) → null", () => {
    expect(dataNascitaDaCF("RSSMRA85M00H501Z", OGGI), "giorno 00").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85M32H501Z", OGGI), "giorno 32").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85M40H501Z", OGGI), "giorno 40 (né uomo né donna)").toBeNull();
    expect(dataNascitaDaCF("RSSMRA85M72H501Z", OGGI), "donna, giorno 32").toBeNull();
    // Il primo giorno «da donna» valido è 41.
    expect(iso(dataNascitaDaCF("RSSMRA85M41H501Z", OGGI))).toBe("1985-08-01");
  });

  /* ── Il secolo, che nel codice non c'è ───────────────────────────────── */

  it("inferenza del secolo: un anno che cadrebbe nel FUTURO va nel secolo precedente", () => {
    // «99» nel 2026 non può essere 2099: è 1999.
    expect(iso(dataNascitaDaCF("RSSMRA99M01H501Z", OGGI))).toBe("1999-08-01");
    // «26» = quest'anno → resta 2026 (non è futuro).
    expect(iso(dataNascitaDaCF("RSSMRA26A01H501Z", OGGI))).toBe("2026-01-01");
    // «27» sarebbe l'anno prossimo → 1927.
    expect(iso(dataNascitaDaCF("RSSMRA27A01H501Z", OGGI))).toBe("1927-01-01");
    // Lo stesso codice letto in un altro «oggi» cambia secolo: la scelta dipende
    // dal parametro, non dall'orologio della macchina.
    expect(iso(dataNascitaDaCF("RSSMRA27A01H501Z", utc(2030, 1, 1)))).toBe("2027-01-01");
  });
});

describe("eMinorenne · il verdetto a tre valori", () => {
  // Nato il 1° agosto 2008: compie 18 anni il 1° agosto 2026.
  const CF_2008 = "RSSMRA08M01H501Z";

  it("il giorno ESATTO del 18° compleanno è già maggiorenne", () => {
    expect(eMinorenne(CF_2008, utc(2026, 8, 1))).toBe(false);
  });

  it("il giorno PRIMA del 18° compleanno è ancora minorenne", () => {
    expect(eMinorenne(CF_2008, utc(2026, 7, 31))).toBe(true);
  });

  it("il giorno dopo resta maggiorenne, e un anno prima resta minorenne", () => {
    expect(eMinorenne(CF_2008, utc(2026, 8, 2))).toBe(false);
    expect(eMinorenne(CF_2008, utc(2025, 8, 1))).toBe(true);
  });

  it("l'ORA del giorno non sposta il verdetto (confronto a giorni pieni)", () => {
    const mezzanotte = new Date(Date.UTC(2026, 7, 1, 0, 0, 0));
    const seraTardi = new Date(Date.UTC(2026, 7, 1, 23, 59, 59));
    expect(eMinorenne(CF_2008, mezzanotte)).toBe(false);
    expect(eMinorenne(CF_2008, seraTardi)).toBe(false);
    const vigiliaSera = new Date(Date.UTC(2026, 6, 31, 23, 59, 59));
    expect(eMinorenne(CF_2008, vigiliaSera)).toBe(true);
  });

  it("29 febbraio: il compleanno «che non c'è» cade il 1° marzo dell'anno non bisestile", () => {
    // Nata il 29/02/2008 (donna: 29 + 40 = 69). Nel 2026, il 18° compleanno
    // calcolato è il 1° marzo (Date.UTC(2026,1,29) scivola lì): il 28 febbraio
    // è ancora minorenne, il 1° marzo è maggiorenne. Comportamento dichiarato.
    const CF = "BNCLRA08B69H501Z";
    expect(iso(dataNascitaDaCF(CF, OGGI))).toBe("2008-02-29");
    expect(eMinorenne(CF, utc(2026, 2, 28))).toBe(true);
    expect(eMinorenne(CF, utc(2026, 3, 1))).toBe(false);
  });

  it("CF malformato / vuoto / null → **null** («non lo so»), MAI false", () => {
    for (const cf of [null, undefined, "", "  ", "Mario Rossi", "RSSMRA85M01H501", "RSSMRA85I01H501Z"]) {
      const esito = eMinorenne(cf, OGGI);
      expect(esito, `«${String(cf)}» deve dare null, non un verdetto`).toBeNull();
      // La distinzione che conta: `null` non è `false`.
      expect(esito).not.toBe(false);
    }
  });

  it("data inesistente nel CF → null (nessuna proposta tutore a caso)", () => {
    expect(eMinorenne("RSSMRA85B31H501Z", OGGI)).toBeNull();
    expect(eMinorenne("RSSMRA85M00H501Z", OGGI)).toBeNull();
  });

  it("un adulto di lungo corso è `false`, un neonato è `true` (il test non è vacuo)", () => {
    expect(eMinorenne("RSSMRA50M01H501Z", OGGI)).toBe(false);
    expect(eMinorenne("RSSMRA25M01H501Z", OGGI)).toBe(true); // 2025, un anno
  });

  it("chi chiama distingue i tre casi: true / false / null sono tre rami diversi", () => {
    const casi: [string | null, boolean | null][] = [
      ["RSSMRA10M01H501Z", true], // 2010 → minorenne nel 2026
      ["RSSMRA00M01H501Z", false], // 2000 → maggiorenne
      ["non-un-cf", null],
      [null, null],
    ];
    for (const [cf, atteso] of casi) {
      expect(eMinorenne(cf, OGGI), `CF ${String(cf)}`).toBe(atteso);
    }
  });
});
