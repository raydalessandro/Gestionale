/**
 * Quadratura di cassa — la formula UNICA (§2.2 Fase 4c, audit A1/A3).
 *
 * La usano identica la chiusura (blocco 1) e i "contanti attesi" della homepage:
 * due schermate, un solo calcolo, così il numero non litiga mai con se stesso.
 * Solo funzioni pure: nessun accesso al DB, nessun "use client"/"use server".
 */
import type { PagamentoVendita } from "@/lib/database.types";

/** Nome riservato del metodo "Caparra": la caparra scalata non è denaro del giorno. */
export const NOME_CAPARRA = "caparra";

const e2 = (n: number) => Math.round(n * 100) / 100;

export type VenditaCalc = { pagamenti: unknown };
export type ResoDenaroCalc = { metodo_rimborso: string | null; importo: number };
export type AccontoCalc = { acconto: number; acconto_metodo: string | null };

function pagamentiDi(v: VenditaCalc): PagamentoVendita[] {
  return (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[];
}

/**
 * sistema(M) = Σ vendite.pagamenti[M] del giorno (esclusa la voce 'Caparra')
 *            + Σ acconti incassati oggi con acconto_metodo = M
 *            − Σ resi 'denaro' del giorno con metodo_rimborso = M.
 * Restituisce la mappa metodo → importo di sistema.
 */
export function sistemaPerMetodo(
  venditeOggi: VenditaCalc[],
  resiDenaroOggi: ResoDenaroCalc[],
  accontiOggi: AccontoCalc[]
): Map<string, number> {
  const m = new Map<string, number>();
  const add = (nome: string, v: number) => m.set(nome, e2((m.get(nome) ?? 0) + v));

  for (const vend of venditeOggi) {
    for (const p of pagamentiDi(vend)) {
      if (p.nome.toLowerCase() === NOME_CAPARRA) continue; // scalata, non denaro del giorno
      add(p.nome, p.importo);
    }
  }
  for (const a of accontiOggi) {
    if (a.acconto_metodo && a.acconto > 0) add(a.acconto_metodo, a.acconto);
  }
  for (const r of resiDenaroOggi) {
    add(r.metodo_rimborso ?? "Contanti", -r.importo);
  }
  return m;
}

/** Caparre incassate oggi ma senza metodo registrato (buste col backfill 007): riga informativa fuori conteggio. */
export function caparreSenzaMetodo(accontiOggi: AccontoCalc[]): number {
  return e2(
    accontiOggi
      .filter((a) => !a.acconto_metodo && a.acconto > 0)
      .reduce((s, a) => s + a.acconto, 0)
  );
}

/** Contanti attesi in cassetto = fondo + sistema('Contanti') − prelievi/spese di oggi (§2.2). */
export function contantiAttesi(
  fondoApertura: number,
  sistema: Map<string, number>,
  prelieviSpese: number
): number {
  return e2(fondoApertura + (sistema.get("Contanti") ?? 0) - prelieviSpese);
}

/** I quattro contatori caparre del giorno — come il report di catena (§2.4, audit A2). */
export function contatoriCaparre(input: {
  accontiEmessiOggi: { acconto: number }[];
  venditeOggi: VenditaCalc[];
  resiCaparraOggi: { importo: number }[];
  incameriOggi: { importo: number }[];
}): { emesse: number; scontate: number; rese: number; incamerate: number } {
  const emesse = e2(input.accontiEmessiOggi.reduce((s, o) => s + (o.acconto ?? 0), 0));
  let scontate = 0;
  for (const v of input.venditeOggi) {
    for (const p of pagamentiDi(v)) {
      if (p.nome.toLowerCase() === NOME_CAPARRA) scontate = e2(scontate + p.importo);
    }
  }
  const rese = e2(input.resiCaparraOggi.reduce((s, r) => s + r.importo, 0));
  const incamerate = e2(input.incameriOggi.reduce((s, m) => s + m.importo, 0));
  return { emesse, scontate, rese, incamerate };
}
