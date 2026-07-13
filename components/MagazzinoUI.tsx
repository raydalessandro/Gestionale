import { Badge } from "@/components/ui";
import { STATI_FERMO, statoDi, ETICHETTE_MOVIMENTO } from "@/lib/utils";

export const ETICHETTE_TIPO_PRODOTTO: Record<string, string> = {
  lac: "Lente a contatto",
  soluzione: "Soluzione",
  montatura: "Montatura",
  lente: "Lente oftalmica",
  accessorio: "Accessorio",
  servizio: "Servizio",
};

/** Sotto scorta: attivo, soglia > 0, giacenza ≤ soglia (§2.5). */
export function sottoScorta(p: {
  attivo: boolean;
  giacenza: number;
  scorta_minima: number;
}): boolean {
  return p.attivo && p.scorta_minima > 0 && p.giacenza <= p.scorta_minima;
}

export function fermoScaduto(f: { stato: string; scade_il: string | null }): boolean {
  return (
    f.stato === "attivo" &&
    f.scade_il != null &&
    new Date(f.scade_il).getTime() < Date.now()
  );
}

/** Parametri LAC salvati nel jsonb prodotti.parametri. */
export function parametriLac(parametri: unknown): {
  raggio: number | null;
  diametro: number | null;
  confezione: string | null;
} {
  const p = (parametri ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    raggio: n(p.raggio),
    diametro: n(p.diametro),
    confezione: typeof p.confezione === "string" ? p.confezione : null,
  };
}

export function BadgeTipoProdotto({ tipo }: { tipo: string }) {
  return <Badge tinta="neutro">{ETICHETTE_TIPO_PRODOTTO[tipo] ?? tipo}</Badge>;
}

export function PillFermo({ stato }: { stato: string }) {
  const s = statoDi(STATI_FERMO, stato);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

/** Quantità di un movimento col segno, colorata (verde/rosso). */
export function QuantitaMovimento({ quantita }: { quantita: number }) {
  const pos = quantita > 0;
  return (
    <span
      className={`f-mono font-semibold tabular-nums ${pos ? "text-verde" : "text-rosso"}`}
    >
      {pos ? "+" : ""}
      {quantita}
    </span>
  );
}

export function etichettaMovimento(tipo: string): string {
  return ETICHETTE_MOVIMENTO[tipo] ?? tipo;
}
