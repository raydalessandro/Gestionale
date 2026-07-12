import type { ReactNode } from "react";
import {
  STATI_LAC,
  STATI_BUSTA,
  statoDi,
  fmtRefrazione,
  fmtDiottria,
} from "@/lib/utils";

/* ── Etichette di dominio ──────────────────────────────────────────── */

export const ETICHETTE_TIPO_LAVORO: Record<string, string> = {
  occhiale_completo: "Occhiale completo",
  solo_lenti: "Solo lenti",
  solo_montatura: "Solo montatura",
  montatura_cliente: "Montatura del cliente",
};

export const DESCR_TIPO_LAVORO: Record<string, string> = {
  occhiale_completo: "Montatura nuova più lenti su misura.",
  solo_lenti: "Solo le lenti: la montatura è già in negozio o del cliente.",
  solo_montatura: "Solo la montatura, senza lenti graduate.",
  montatura_cliente: "Il cliente porta la sua montatura (frame to come).",
};

/** Stati considerati "finali" (nessun avanzamento possibile). */
export const STATI_FINALI_LAC = ["consegnato", "annullato"];
export const STATI_FINALI_BUSTA = ["consegnata", "annullata"];

/* ── Descrizioni sintetiche per le liste ───────────────────────────── */

export function descrizioneLac(righe: unknown): string {
  const arr = Array.isArray(righe) ? righe : [];
  if (arr.length === 0) return "Nessuna riga";
  const prima =
    (arr[0] as { descrizione?: string })?.descrizione?.trim() || "Riga";
  return arr.length > 1 ? `${prima} +${arr.length - 1}` : prima;
}

export function descrizioneBusta(b: {
  lente_tipo: string | null;
  lente_indice: string | null;
  tipo_lavoro: string;
}): string {
  return [b.lente_tipo, b.lente_indice, ETICHETTE_TIPO_LAVORO[b.tipo_lavoro]]
    .filter(Boolean)
    .join(" · ");
}

/* ── Telefono / WhatsApp ───────────────────────────────────────────── */

/** Toglie spazi e trattini; se non inizia con "+", prefissa "+39". */
export function normalizzaTelefono(tel: string): string {
  const pulito = tel.replace(/[\s-]/g, "");
  return pulito.startsWith("+") ? pulito : `+39${pulito}`;
}

export function waLink(tel: string, messaggio: string): string {
  const numero = normalizzaTelefono(tel).replace(/[^\d]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`;
}

/* ── Presentazione ─────────────────────────────────────────────────── */

/** Pill di stato con i colori bg/fg della pipeline (hex da utils). */
export function PillStato({
  stato,
  tipo,
}: {
  stato: string;
  tipo: "lac" | "busta";
}) {
  const s = statoDi(tipo === "lac" ? STATI_LAC : STATI_BUSTA, stato);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

/** Riga refrazione compatta in mono (riusa fmtRefrazione). */
export function RxMono({
  p,
  className = "",
}: {
  p: {
    od_sfero: number | null;
    od_cilindro: number | null;
    od_asse: number | null;
    os_sfero: number | null;
    os_cilindro: number | null;
    os_asse: number | null;
    addizione: number | null;
  };
  className?: string;
}) {
  const testo = [
    `OD ${fmtRefrazione(p.od_sfero, p.od_cilindro, p.od_asse)}`,
    `OS ${fmtRefrazione(p.os_sfero, p.os_cilindro, p.os_asse)}`,
    p.addizione !== null ? `ADD ${fmtDiottria(p.addizione)}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  return (
    <span className={`f-mono text-xs tabular-nums text-inchiostro ${className}`}>
      {testo}
    </span>
  );
}

/** Mini-card contatore per le testate di pipeline. */
export function ContatoreCard({
  valore,
  label,
  nota,
}: {
  valore: number;
  label: string;
  nota?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-linea bg-white p-4 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <p className="f-mono text-2xl font-semibold tabular-nums text-inchiostro">
        {valore}
      </p>
      <p className="mt-1 text-xs font-medium text-soft">{label}</p>
      {nota && <p className="mt-0.5 text-[10px] text-faint">{nota}</p>}
    </div>
  );
}
