"use client";

import { useActionState, useState } from "react";
import {
  seedMetodiPagamento,
  creaMetodoPagamento,
  aggiornaMetodoPagamento,
} from "@/lib/actions";
import type { MetodoPagamentoRow } from "@/lib/database.types";
import { inputCls, Errore } from "@/components/ui";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";

const TIPI: Record<string, string> = {
  contanti: "Contanti",
  elettronico: "Elettronico",
  buono: "Buono",
  bonifico: "Bonifico",
  assicurazione: "Assicurazione",
  caparra: "Caparra",
  altro: "Altro",
};

export function SeedMetodi() {
  const [stato, run, inCorso] = useActionState(seedMetodiPagamento, null);
  return (
    <form action={run} className="space-y-2">
      <button type="submit" disabled={inCorso} className={`${btn} bg-ottone text-white hover:bg-ottone-scuro`}>
        {inCorso ? "Creo…" : "Crea i metodi di base"}
      </button>
      <Errore msg={stato?.errore} />
    </form>
  );
}

export function NuovoMetodo() {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaMetodoPagamento, null);
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className={`${btn} bg-inchiostro text-carta hover:bg-black`}>
        Nuovo metodo
      </button>
    );
  }
  return (
    <form action={run} className="space-y-2 rounded-xl border border-linea bg-white p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input name="nome" placeholder="Nome (es. American Express)" className={inputCls} />
        <select name="tipo" defaultValue="elettronico" className={inputCls}>
          {Object.entries(TIPI).filter(([id]) => id !== "caparra").map(([id, l]) => (
            <option key={id} value={id}>{l}</option>
          ))}
        </select>
        <input name="ordine" type="number" min={0} step={1} defaultValue={9} placeholder="Ordine" className={`${inputCls} diottria`} />
      </div>
      <label className="flex items-center gap-2 text-sm text-inchiostro">
        <input type="checkbox" name="tracciabile" defaultChecked className="h-4 w-4 accent-[#A67C42]" /> Tracciabile
      </label>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} bg-inchiostro text-carta hover:bg-black`}>{inCorso ? "…" : "Crea"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Chiudi</button>
      </div>
    </form>
  );
}

export function RigaMetodo({ metodo }: { metodo: MetodoPagamentoRow }) {
  const [stato, run, inCorso] = useActionState(aggiornaMetodoPagamento.bind(null, metodo.id), null);
  const caparra = metodo.tipo === "caparra";
  return (
    <form action={run} className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-inchiostro">{metodo.nome}</p>
        <p className="text-[11px] text-faint">{TIPI[metodo.tipo] ?? metodo.tipo}{caparra ? " · non disattivabile" : ""}</p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-soft">
        <input type="checkbox" name="tracciabile" defaultChecked={metodo.tracciabile} className="h-4 w-4 accent-[#A67C42]" /> tracciabile
      </label>
      <input name="ordine" type="number" min={0} step={1} defaultValue={metodo.ordine} className={`${inputCls} diottria w-16 !px-2 !py-1`} aria-label="ordine" />
      <label className="flex items-center gap-1.5 text-xs text-soft">
        <input type="checkbox" name="attivo" defaultChecked={metodo.attivo} disabled={caparra} className="h-4 w-4 accent-[#A67C42]" /> attivo
      </label>
      <button type="submit" disabled={inCorso} className="rounded-lg border border-linea bg-white px-3 py-1.5 text-xs font-semibold text-inchiostro hover:bg-carta disabled:opacity-50">
        {inCorso ? "…" : "Salva"}
      </button>
      <Errore msg={stato?.errore} />
    </form>
  );
}
