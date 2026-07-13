"use client";

import { useActionState, useState } from "react";
import { annullaVendita, creaReso } from "@/lib/actions";
import { inputCls, Errore } from "@/components/ui";
import { ETICHETTE_CAUSALI_RESO, fmtEuro } from "@/lib/utils";
import type { RigaVendita } from "@/lib/database.types";

const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";

export function AnnullaVendita({ id }: { id: string }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(annullaVendita.bind(null, id), null);
  if (!aperto) {
    return <button type="button" onClick={() => setAperto(true)} className={`${btn} border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft`}>Annulla vendita</button>;
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea p-3">
      <textarea name="motivo" rows={2} required placeholder="Motivo dell'annullo…" className={inputCls} />
      <p className="text-[11px] text-faint">Se legata a un ordine: l&apos;ordine resta consegnato, gestisci l&apos;eventuale reso a parte.</p>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft`}>{inCorso ? "…" : "Conferma annullo"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Chiudi</button>
      </div>
    </form>
  );
}

export function RegistraReso({
  venditaId,
  clienteId,
  righe,
  totale,
  metodi,
}: {
  venditaId: string;
  clienteId: string | null;
  righe: RigaVendita[];
  totale: number;
  metodi: { id: string; nome: string }[];
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaReso, null);
  const [tipo, setTipo] = useState<"denaro" | "gestionale">("denaro");
  const [sel, setSel] = useState<Record<number, boolean>>({});

  const righeSel = righe.filter((_, i) => sel[i]);
  const righeJson = JSON.stringify(righeSel);

  if (!aperto) {
    return <button type="button" onClick={() => setAperto(true)} className={`${btn} bg-inchiostro text-carta hover:bg-black`}>Registra reso</button>;
  }
  return (
    <form action={run} className="w-full space-y-3 rounded-xl border border-linea p-3">
      <input type="hidden" name="vendita_id" value={venditaId} />
      <input type="hidden" name="cliente_id" value={clienteId ?? ""} />
      <input type="hidden" name="righe" value={righeJson} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "denaro" | "gestionale")} className={inputCls} aria-label="tipo reso">
          <option value="denaro">Reso con rimborso (denaro)</option>
          <option value="gestionale">Reso gestionale (nessun rimborso)</option>
        </select>
        <select name="causale" defaultValue="" required className={inputCls} aria-label="causale">
          <option value="" disabled>Causale…</option>
          {Object.entries(ETICHETTE_CAUSALI_RESO).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
        </select>
        <input name="importo" type="number" min={0} step="0.01" defaultValue={totale} placeholder="Importo €" className={`${inputCls} diottria`} />
        {tipo === "denaro" && (
          <select name="metodo_rimborso" defaultValue={metodi[0]?.nome ?? "Contanti"} className={inputCls} aria-label="metodo rimborso">
            {metodi.map((m) => (<option key={m.id} value={m.nome}>{m.nome}</option>))}
          </select>
        )}
      </div>

      {righe.some((r) => r.prodotto_id) && (
        <div className="rounded-xl border border-linea bg-carta p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Righe che rientrano a magazzino</p>
          {righe.map((r, i) =>
            r.prodotto_id ? (
              <label key={i} className="flex items-center gap-2 py-1 text-sm text-inchiostro">
                <input type="checkbox" checked={!!sel[i]} onChange={(e) => setSel((s) => ({ ...s, [i]: e.target.checked }))} className="h-4 w-4 accent-[#A67C42]" />
                {r.descrizione} · {r.quantita} × {fmtEuro(r.prezzo_unitario)}
              </label>
            ) : null
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input name="doc_numero" placeholder="N° documento reso (RT)" className={`${inputCls} f-mono`} />
        <input name="doc_data" type="date" className={inputCls} aria-label="data documento reso" />
      </div>
      <input name="note" placeholder="Note" className={inputCls} />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} bg-inchiostro text-carta hover:bg-black`}>{inCorso ? "…" : "Registra reso"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} border border-linea bg-white text-inchiostro hover:bg-carta`}>Chiudi</button>
      </div>
    </form>
  );
}
