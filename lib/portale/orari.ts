import type { OrarioPubblicoRow, ChiusuraPubblicaRow } from "@/lib/database.types";

/**
 * Orari del portale (G5) — fuso, raggruppamento, «aperto ora».
 *
 * FUSO: gli orari sono ora locale di PARETE («09:00» = le nove a Milano, non
 * UTC). Nel repo non c'è oggi una gestione esplicita del fuso (lib/utils.ts
 * formatta senza `timeZone`, quindi su Vercel eredita UTC — difetto preesistente,
 * vedi TODO). Qui la regola è secca: OGNI confronto e OGNI formattazione oraria
 * del portale passa da questo helper, che àncora tutto a Europe/Rome. Niente
 * `new Date()` nudo confrontato con un orario di apertura.
 */

export const TZ = "Europe/Rome";

const NOMI_GIORNO = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;
// Ordine di lettura all'italiana: da lunedì a domenica.
const ORDINE_SETTIMANA = [1, 2, 3, 4, 5, 6, 0] as const;

/** L'istante `adesso` visto come ora di parete a Roma: giorno, minuti, data ISO. */
export function oraDiRoma(adesso: Date): { giorno: number; minuti: number; dataISO: string } {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(adesso);
  const MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const giorno = MAP[wd] ?? 0;
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(adesso);
  const [hh, mm] = hm.split(":").map(Number);
  const minuti = hh * 60 + mm;
  const dataISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(adesso);
  return { giorno, minuti, dataISO };
}

/** "09:00:00" → 540 (minuti dalla mezzanotte). Tollera "HH:MM". */
export function minutiDaOra(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

/** "09:00:00" → "9:00" (ora senza zero iniziale, minuti a due cifre). */
export function formattaOra(t: string): string {
  const [hh, mm] = t.split(":");
  return `${Number(hh)}:${mm}`;
}

/** "09:00:00"–"13:00:00" → "9:00–13:00". */
function formattaFascia(apre: string, chiude: string): string {
  return `${formattaOra(apre)}–${formattaOra(chiude)}`;
}

export type RigaOrario = { giorni: string; orario: string };

/**
 * Raggruppa gli orari come li legge una persona: i giorni con le STESSE fasce si
 * uniscono in un intervallo. Es. «Lun–Ven 9:00–13:00 · 15:00–19:30», «Sab
 * 9:00–12:30», «Dom chiuso». I giorni chiusi restano visibili (raggruppati).
 */
export function raggruppaOrari(righe: OrarioPubblicoRow[]): RigaOrario[] {
  // giorno → fasce ordinate per apertura, formattate e unite con " · ".
  const perGiorno = new Map<number, string>();
  for (let g = 0; g <= 6; g++) {
    const fasce = righe
      .filter((r) => r.giorno === g)
      .sort((a, b) => minutiDaOra(a.apre) - minutiDaOra(b.apre))
      .map((r) => formattaFascia(r.apre, r.chiude));
    perGiorno.set(g, fasce.length ? fasce.join(" · ") : "");
  }

  const out: RigaOrario[] = [];
  let i = 0;
  while (i < ORDINE_SETTIMANA.length) {
    const gInizio = ORDINE_SETTIMANA[i];
    const orario = perGiorno.get(gInizio) ?? "";
    // estende la corsa finché i giorni consecutivi hanno la stessa stringa.
    let j = i;
    while (
      j + 1 < ORDINE_SETTIMANA.length &&
      (perGiorno.get(ORDINE_SETTIMANA[j + 1]) ?? "") === orario
    ) {
      j++;
    }
    const etichettaGiorni =
      i === j
        ? NOMI_GIORNO[gInizio]
        : `${NOMI_GIORNO[gInizio]}–${NOMI_GIORNO[ORDINE_SETTIMANA[j]]}`;
    out.push({ giorni: etichettaGiorni, orario: orario || "Chiuso" });
    i = j + 1;
  }
  return out;
}

export type StatoApertura = {
  aperto: boolean;
  /** Se chiuso per ferie che coprono oggi: la data (ISO) di fine chiusura. */
  feriaAlISO: string | null;
};

/**
 * «Aperto ora / Chiuso», calcolato in ora di Roma. Una chiusura per ferie che
 * copre oggi vince su tutto (chiuso, e sappiamo fino a quando). Altrimenti è
 * aperto se l'ora corrente cade dentro una fascia del giorno.
 */
export function statoApertura(
  orari: OrarioPubblicoRow[],
  chiusure: ChiusuraPubblicaRow[],
  adesso: Date
): StatoApertura {
  const { giorno, minuti, dataISO } = oraDiRoma(adesso);

  const feria = chiusure.find((c) => c.dal <= dataISO && dataISO <= c.al);
  if (feria) return { aperto: false, feriaAlISO: feria.al };

  const aperto = orari.some(
    (r) => r.giorno === giorno && minutiDaOra(r.apre) <= minuti && minuti < minutiDaOra(r.chiude)
  );
  return { aperto, feriaAlISO: null };
}

/** "2026-08-22" → "22 agosto" (in italiano, ancorato a Roma). */
export function dataItaliana(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, day: "numeric", month: "long" }).format(d);
}

/** ISO timestamptz → "HH:MM" in ora italiana (per gli slot). */
export function oraDaISO(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Data ISO di «oggi» in ora italiana. */
export function oggiISO(adesso: Date): string {
  return oraDiRoma(adesso).dataISO;
}

/** "2026-08-12" + delta giorni → "2026-08-14". Ancorato a mezzogiorno per non
 *  scivolare di giorno sul cambio d'ora. */
export function giornoRelativo(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "2026-08-12" → "mercoledì 12 agosto" (in italiano). */
export function etichettaGiorno(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
