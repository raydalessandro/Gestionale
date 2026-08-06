"use client";

import { useActionState, useState } from "react";
import { registraConsensi } from "@/lib/actions";
import { inputCls, Errore } from "@/components/ui";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50";

/**
 * Banner discreto ma persistente per il consenso ai DATI SANITARI (A6): è il
 * gate delle prescrizioni, quindi va chiesto appena manca.
 *
 * B1 · il marketing non passa più di qui. Sta nel mastro dei consensi della
 * sezione «Permessi» (contratto C3: la cache non si scrive mai direttamente).
 */
export function BannerConsensi({
  clienteId,
  mancaSanitario,
}: {
  clienteId: string;
  mancaSanitario: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const [oggi] = useState(() => new Date().toISOString().slice(0, 10));
  const [stato, run, inCorso] = useActionState(registraConsensi.bind(null, clienteId), null);

  if (!mancaSanitario) return null;

  return (
    <div className="mb-4 rounded-xl border border-ottone/40 bg-ottone-soft px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-inchiostro">
          · Consenso dati sanitari: non raccolto
        </div>
        {!aperto && (
          <button type="button" onClick={() => setAperto(true)} className={`${btn} bg-ottone text-white hover:bg-ottone-scuro`}>
            Consenso sanitario
          </button>
        )}
      </div>

      {aperto && (
        <form action={run} className="mt-3 space-y-3 rounded-xl border border-linea bg-white p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <label className="flex items-start gap-2 text-sm text-inchiostro">
              <input type="checkbox" name="consenso_dati_sanitari" className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
              <span>Consenso dati sanitari<span className="block text-xs text-faint">Art. 9 GDPR: serve per le prescrizioni.</span></span>
            </label>
            <input name="data_sanitario" type="date" defaultValue={oggi} className={inputCls} aria-label="data consenso sanitario" />
          </div>
          <p className="text-[11px] text-faint">La data è modificabile per consensi raccolti in passato su carta.</p>
          <Errore msg={stato?.errore} />
          <div className="flex gap-2">
            <button type="submit" disabled={inCorso} className={`${btn} bg-inchiostro text-carta hover:bg-black`}>
              {inCorso ? "Salvo…" : "Salva il consenso sanitario"}
            </button>
            <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>
              Chiudi
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
