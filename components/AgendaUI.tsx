import {
  STATI_APPUNTAMENTO,
  TIPI_APPUNTAMENTO,
  TIPI_RICHIAMO,
  statoDi,
} from "@/lib/utils";

/** Ora HH:MM da un timestamp ISO (coerente col fuso del server). */
export function oraDi(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

export function oraFine(iso: string, durataMin: number): string {
  return new Date(new Date(iso).getTime() + durataMin * 60000).toISOString().slice(11, 16);
}

export function etichettaTipoApp(tipo: string): string {
  return TIPI_APPUNTAMENTO[tipo] ?? tipo;
}

export function etichettaTipoRichiamo(tipo: string): string {
  return TIPI_RICHIAMO[tipo] ?? tipo;
}

export function PillStatoApp({ stato }: { stato: string }) {
  const s = statoDi(STATI_APPUNTAMENTO, stato);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
