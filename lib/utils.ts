/** Utility di dominio — formattazioni "da banco". */

/** Diottrie: segno sempre esplicito, due decimali, meno tipografico. */
export function fmtDiottria(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = v.toFixed(2);
  if (v > 0) return `+${s}`;
  if (v < 0) return `−${s.replace("-", "")}`;
  return "0.00";
}

/** Riga di refrazione compatta: "−2.00 −0.50 × 180°" (o "plano"). */
export function fmtRefrazione(
  sfero: number | null,
  cilindro: number | null,
  asse: number | null
): string {
  if (sfero == null && cilindro == null) return "—";
  const sf = sfero == null || sfero === 0 ? "plano" : fmtDiottria(sfero);
  if (cilindro == null || cilindro === 0) return sf;
  return `${sf} ${fmtDiottria(cilindro)} × ${asse ?? 0}°`;
}

export function fmtEuro(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
    new Date(iso)
  );
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/** Numero progressivo tipo "BL-2026-0141" (contatore gestito in-app per ora). */
export function generaNumero(prefisso: "BL" | "OL", progressivo: number): string {
  const anno = new Date().getFullYear();
  return `${prefisso}-${anno}-${String(progressivo).padStart(4, "0")}`;
}

export const ETICHETTE_FONTE: Record<string, string> = {
  banco: "Banco",
  sito: "Dal sito",
  app: "Dall'app",
  convenzione: "Convenzione",
  import: "Import",
};

/* ── Stati pipeline (colori demo + estensioni fase 1) ─────────────── */

export interface StatoPipeline {
  id: string;
  label: string;
  bg: string;
  fg: string;
}

export const STATI_LAC: StatoPipeline[] = [
  { id: "da_ordinare", label: "Da ordinare", bg: "#F7EEDD", fg: "#C98A2B" },
  { id: "ordinato", label: "Ordinato", bg: "#E7EAF6", fg: "#5B6DA8" },
  { id: "arrivato", label: "Arrivato · avvisa", bg: "#E2F0EE", fg: "#127E7A" },
  { id: "consegnato", label: "Consegnato", bg: "#F2F5F4", fg: "#274744" },
  { id: "annullato", label: "Annullato", bg: "#F6E4E2", fg: "#B0483F" },
];

export const STATI_BUSTA: StatoPipeline[] = [
  { id: "preventivo", label: "Preventivo", bg: "#EFEBE2", fg: "#6B5D50" },
  { id: "lavorazione", label: "In lavorazione", bg: "#E7EAF6", fg: "#5B6DA8" },
  { id: "arrivata", label: "Arrivata · ispeziona", bg: "#F7EEDD", fg: "#C98A2B" },
  { id: "pronta", label: "Pronta · avvisa", bg: "#E2F0EE", fg: "#127E7A" },
  { id: "consegnata", label: "Consegnata", bg: "#F2F5F4", fg: "#274744" },
  { id: "annullata", label: "Annullata", bg: "#F6E4E2", fg: "#B0483F" },
];

export function statoDi(
  lista: StatoPipeline[],
  id: string
): StatoPipeline {
  return (
    lista.find((s) => s.id === id) ?? {
      id,
      label: id,
      bg: "#F2F5F4",
      fg: "#274744",
    }
  );
}

/** "adesso" · "5 min fa" · "3 ore fa" · "ieri" · "4 gg fa" · data. */
export function fmtQuando(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore} or${ore === 1 ? "a" : "e"} fa`;
  const gg = Math.floor(ore / 24);
  if (gg === 1) return "ieri";
  if (gg < 30) return `${gg} gg fa`;
  return fmtData(iso);
}

/** Prescrizione utilizzabile: attiva e non scaduta (data visita + validità). */
export function rxValida(p: {
  attiva: boolean;
  data_visita: string;
  validita_mesi: number;
}): boolean {
  if (!p.attiva) return false;
  const scadenza = new Date(p.data_visita);
  scadenza.setMonth(scadenza.getMonth() + p.validita_mesi);
  return scadenza.getTime() >= Date.now();
}

/* ── Magazzino (fase 2) ────────────────────────────────────────────── */

export const ETICHETTE_MOVIMENTO: Record<string, string> = {
  carico: "Carico",
  scarico: "Scarico",
  ordine_cliente: "Ordine cliente",
  rettifica: "Rettifica",
  reso_fornitore: "Reso a fornitore",
  danno: "Danno / smaltimento",
  uso_interno: "Uso interno",
};

export const STATI_FERMO: StatoPipeline[] = [
  { id: "attivo", label: "Attivo", bg: "#F7EEDD", fg: "#C98A2B" },
  { id: "ritirato", label: "Ritirato", bg: "#F2F5F4", fg: "#274744" },
  { id: "annullato", label: "Annullato", bg: "#F6E4E2", fg: "#B0483F" },
];
