"use client";

import { useActionState } from "react";
import { eventoAppuntamento } from "@/lib/actions";
import { Errore } from "@/components/ui";

/** Azioni inline su un appuntamento prenotato (§2.7). */
export function AzioniAppuntamento({ id }: { id: string }) {
  const [sc, runC, inC] = useActionState(eventoAppuntamento.bind(null, id, "completa"), null);
  const [sm, runM, inM] = useActionState(eventoAppuntamento.bind(null, id, "mancato"), null);
  const [sa, runA, inA] = useActionState(eventoAppuntamento.bind(null, id, "annulla"), null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={runC}>
          <button type="submit" disabled={inC} className="rounded-lg bg-inchiostro px-3 py-1.5 text-xs font-semibold text-carta hover:bg-black disabled:opacity-50">
            {inC ? "…" : "Completato"}
          </button>
        </form>
        <form action={runM}>
          <button type="submit" disabled={inM} className="rounded-lg border border-linea bg-white px-3 py-1.5 text-xs font-semibold text-soft hover:bg-carta disabled:opacity-50">
            {inM ? "…" : "Non presentato"}
          </button>
        </form>
        <form action={runA}>
          <button type="submit" disabled={inA} className="rounded-lg border border-rosso/40 bg-white px-3 py-1.5 text-xs font-semibold text-rosso hover:bg-rosso-soft disabled:opacity-50">
            {inA ? "…" : "Annulla"}
          </button>
        </form>
      </div>
      <Errore msg={sc?.errore ?? sm?.errore ?? sa?.errore} />
    </div>
  );
}
