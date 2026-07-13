"use client";

import { useActionState, useState } from "react";
import { incameraCaparra, annullaBustaConRestituzione } from "@/lib/actions";
import { inputCls, Errore } from "@/components/ui";
import { ETICHETTE_CAUSALI_RESO, fmtEuro } from "@/lib/utils";

const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";

export function AzioniCaparra({
  bustaId,
  acconto,
  metodi,
}: {
  bustaId: string;
  acconto: number;
  metodi: { id: string; nome: string }[];
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <IncameraCaparra bustaId={bustaId} acconto={acconto} />
      <AnnullaRestituisci bustaId={bustaId} acconto={acconto} metodi={metodi} />
    </div>
  );
}

function IncameraCaparra({ bustaId, acconto }: { bustaId: string; acconto: number }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(incameraCaparra.bind(null, bustaId), null);
  if (!aperto) {
    return <button type="button" onClick={() => setAperto(true)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Incamera caparra</button>;
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-ottone bg-ottone-soft p-3">
      <p className="text-sm text-inchiostro">
        Trattieni la caparra di <span className="f-mono font-semibold">{fmtEuro(acconto)}</span> per mancato ritiro?
      </p>
      <p className="text-[11px] text-soft">
        La trafila prevede 2 mesi dalla promessa e tentativi documentati: il software avvisa, non blocca. La busta passa ad annullata.
      </p>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} bg-ottone text-white hover:bg-ottone-scuro`}>{inCorso ? "…" : "Conferma incameramento"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Chiudi</button>
      </div>
    </form>
  );
}

function AnnullaRestituisci({ bustaId, acconto, metodi }: { bustaId: string; acconto: number; metodi: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(annullaBustaConRestituzione.bind(null, bustaId), null);
  if (!aperto) {
    return <button type="button" onClick={() => setAperto(true)} className={`${btn} border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft`}>Annulla e restituisci caparra</button>;
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea p-3">
      <p className="text-sm text-inchiostro">Restituisci <span className="f-mono font-semibold">{fmtEuro(acconto)}</span> e annulla la busta.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="causale" defaultValue="modifica_wo" className={inputCls} aria-label="causale">
          {Object.entries(ETICHETTE_CAUSALI_RESO).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
        </select>
        <select name="metodo_rimborso" defaultValue={metodi[0]?.nome ?? "Contanti"} className={inputCls} aria-label="metodo rimborso">
          {metodi.map((m) => (<option key={m.id} value={m.nome}>{m.nome}</option>))}
        </select>
      </div>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft`}>{inCorso ? "…" : "Restituisci e annulla"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Chiudi</button>
      </div>
    </form>
  );
}
