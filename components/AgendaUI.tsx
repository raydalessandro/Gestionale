import {
  STATI_APPUNTAMENTO,
  TIPI_APPUNTAMENTO,
  TIPI_RICHIAMO,
  statoDi,
} from "@/lib/utils";

/** Ora HH:MM di PARETE italiana da un timestamp ISO (Europe/Rome, non UTC del
 *  processo): l'appuntamento delle 10:00 si legge «10:00» anche in produzione,
 *  qualunque sia l'istante assoluto salvato. Vedi lib/utils § fuso / TODO §6. */
const FMT_ORA_ROMA = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function oraDi(iso: string): string {
  return FMT_ORA_ROMA.format(new Date(iso));
}

export function oraFine(iso: string, durataMin: number): string {
  return FMT_ORA_ROMA.format(new Date(new Date(iso).getTime() + durataMin * 60000));
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
