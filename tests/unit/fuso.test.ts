import { describe, it, expect } from "vitest";
import { istanteRomaISO, oggiRoma } from "@/lib/utils";

/**
 * L1 · Unit — il fuso di parete italiana (TODO-ray §6, reso concreto da G8).
 *
 * `istanteRomaISO(data, ora)` deve dare l'istante ASSOLUTO che a Roma segna quella
 * ora di parete, gestendo da sé l'ora legale e INDIPENDENTE dal fuso del processo.
 * Il punto vero di questi test: passano identici anche con `TZ=UTC`
 * (`TZ=UTC npx vitest run tests/unit/fuso.test.ts`) — perché usano `Intl` con
 * timeZone esplicito e `Date.UTC`, mai il fuso di sistema. Se `creaAppuntamento`
 * tornasse a `new Date(\`${data}T${ora}\`)`, in CI/Vercel (UTC) «10:00» slitterebbe
 * di due ore e questi valori fissi diventerebbero rossi.
 */

describe("istanteRomaISO — ora di parete italiana → istante assoluto", () => {
  it("estate (ora legale, +02:00): 2026-08-01 10:00 → 08:00Z", () => {
    expect(istanteRomaISO("2026-08-01", "10:00")).toBe("2026-08-01T08:00:00.000Z");
  });

  it("inverno (ora solare, +01:00): 2026-01-15 10:00 → 09:00Z", () => {
    expect(istanteRomaISO("2026-01-15", "10:00")).toBe("2026-01-15T09:00:00.000Z");
  });

  it("mezzanotte italiana → giorno prima in UTC", () => {
    // Estate: 00:00 a Roma (+02) = 22:00Z del giorno precedente.
    expect(istanteRomaISO("2026-08-01", "00:00")).toBe("2026-07-31T22:00:00.000Z");
    // Inverno: 00:00 a Roma (+01) = 23:00Z del giorno precedente.
    expect(istanteRomaISO("2026-01-15", "00:00")).toBe("2026-01-14T23:00:00.000Z");
  });

  it("gestisce da sé il salto dell'ora legale (marzo/ottobre 2026)", () => {
    // DST inizia l'ultima domenica di marzo (29/03/2026): il 10:00 è già +02.
    expect(istanteRomaISO("2026-03-29", "10:00")).toBe("2026-03-29T08:00:00.000Z");
    // DST finisce l'ultima domenica di ottobre (25/10/2026): il 10:00 è +01.
    expect(istanteRomaISO("2026-10-25", "10:00")).toBe("2026-10-25T09:00:00.000Z");
  });

  it("un istante d'estate riletto a Roma torna l'ora di partenza (round-trip)", () => {
    const iso = istanteRomaISO("2026-08-01", "10:00");
    const oraRoma = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    expect(oraRoma).toBe("10:00");
  });
});

describe("oggiRoma — la data odierna in ora italiana", () => {
  it("ritorna il formato YYYY-MM-DD", () => {
    expect(oggiRoma()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("è la data italiana, non quella del processo (entro ±1 giorno da UTC)", () => {
    // Non si può fissare «oggi», ma la data di Roma dista al più 1 giorno da quella
    // UTC (Roma è avanti): confronto robusto e TZ-independent.
    const romaMs = new Date(`${oggiRoma()}T12:00:00Z`).getTime();
    const utcOggi = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
    const utcMs = new Date(`${utcOggi}T12:00:00Z`).getTime();
    expect(Math.abs(romaMs - utcMs)).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
