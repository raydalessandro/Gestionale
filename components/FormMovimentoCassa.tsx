"use client";

import { useActionState, useState } from "react";
import { registraMovimentoCassa } from "@/lib/actions";
import { inputCls, Errore } from "@/components/ui";
import { TIPI_MOVIMENTO_CASSA } from "@/lib/utils";

export default function FormMovimentoCassa() {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(registraMovimentoCassa, null);

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="rounded-xl border border-linea bg-white px-4 py-2 text-sm font-semibold text-inchiostro hover:bg-carta">
        Registra movimento
      </button>
    );
  }
  return (
    <form action={run} className="space-y-2 rounded-xl border border-linea bg-carta p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select name="tipo" defaultValue="prelievo" className={inputCls} aria-label="tipo movimento">
          {Object.entries(TIPI_MOVIMENTO_CASSA).filter(([id]) => id !== "incamero_caparra").map(([id, l]) => (
            <option key={id} value={id}>{l}</option>
          ))}
        </select>
        <input name="importo" type="number" min={0} step="0.01" placeholder="Importo €" className={`${inputCls} diottria`} />
        <input name="riferimento" placeholder="Riferimento (facoltativo)" className={inputCls} />
      </div>
      <input name="motivo" placeholder="Motivo (obbligatorio)" className={inputCls} />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className="rounded-xl bg-inchiostro px-4 py-2 text-sm font-semibold text-carta hover:bg-black disabled:opacity-50">{inCorso ? "…" : "Registra"}</button>
        <button type="button" onClick={() => setAperto(false)} className="rounded-xl border border-linea bg-white px-4 py-2 text-sm font-semibold text-inchiostro hover:bg-carta">Chiudi</button>
      </div>
    </form>
  );
}
