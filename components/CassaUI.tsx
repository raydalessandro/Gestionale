import { STATI_VENDITA, statoDi, ETICHETTE_CAUSALI_RESO, ETICHETTE_ALIQUOTA } from "@/lib/utils";
import type { ProdottoRow } from "@/lib/database.types";

/** Aliquota + flag DM di default per tipo prodotto da catalogo (§2.2). */
export const ALIQUOTA_DA_TIPO: Record<
  ProdottoRow["tipo"],
  { aliquota: "4" | "22" | "esente"; dm: boolean }
> = {
  lac: { aliquota: "4", dm: true },
  lente: { aliquota: "4", dm: true },
  montatura: { aliquota: "22", dm: true },
  soluzione: { aliquota: "22", dm: true },
  servizio: { aliquota: "22", dm: false },
  accessorio: { aliquota: "22", dm: false },
};

/** IVA contenuta in un importo lordo (prezzi al pubblico IVA inclusa). */
export function ivaScorporo(importoLordo: number, aliquota: string): number {
  if (aliquota === "4") return (importoLordo * 4) / 104;
  if (aliquota === "22") return (importoLordo * 22) / 122;
  return 0;
}

export function etichettaAliquota(a: string): string {
  return ETICHETTE_ALIQUOTA[a] ?? a;
}

export function etichettaCausaleReso(c: string): string {
  return ETICHETTE_CAUSALI_RESO[c] ?? c;
}

export function PillStatoVendita({ stato }: { stato: string }) {
  const s = statoDi(STATI_VENDITA, stato);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
