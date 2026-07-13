"use client";

import { useActionState, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { creaReso } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { inputCls, Errore } from "@/components/ui";
import { ETICHETTE_CAUSALI_RESO } from "@/lib/utils";

type ClienteMini = { id: string; nome: string; cognome: string };

export default function ResoEsterno({ metodi }: { metodi: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaReso, null);
  const supabase = createClient();
  const [tipo, setTipo] = useState<"denaro" | "gestionale">("denaro");
  const [cliente, setCliente] = useState<ClienteMini | null>(null);
  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);

  useEffect(() => {
    if (cliente || term.trim().length < 2) { setRisultati([]); return; }
    const t = setTimeout(async () => {
      const q = term.trim().replace(/[%,]/g, "");
      const { data } = await supabase.from("clienti").select("id, nome, cognome").or(`nome.ilike.%${q}%,cognome.ilike.%${q}%`).limit(8);
      setRisultati(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [term, cliente, supabase]);

  if (!aperto) {
    return <button type="button" onClick={() => setAperto(true)} className="inline-flex items-center gap-2 rounded-xl bg-ottone px-4 py-2.5 text-sm font-semibold text-white hover:bg-ottone-scuro">Nuovo reso</button>;
  }
  return (
    <form action={run} className="space-y-3 rounded-xl border border-linea bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">Reso di vendita esterna</p>
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />

      {cliente ? (
        <div className="flex items-center justify-between rounded-xl border border-linea bg-carta px-3 py-2">
          <span className="text-sm font-semibold text-inchiostro">{cliente.cognome} {cliente.nome}</span>
          <button type="button" onClick={() => setCliente(null)} className="text-xs font-semibold text-ottone-scuro hover:underline">Cambia</button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cliente (facoltativo)…" className={`${inputCls} !pl-9`} />
          {risultati.length > 0 && (
            <div className="mt-1 divide-y divide-linea rounded-xl border border-linea bg-white">
              {risultati.map((c) => (<button key={c.id} type="button" onClick={() => { setCliente(c); setTerm(""); setRisultati([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-carta">{c.cognome} {c.nome}</button>))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "denaro" | "gestionale")} className={inputCls} aria-label="tipo reso">
          <option value="denaro">Con rimborso (denaro)</option>
          <option value="gestionale">Gestionale (nessun rimborso)</option>
        </select>
        <select name="causale" defaultValue="" required className={inputCls} aria-label="causale">
          <option value="" disabled>Causale…</option>
          {Object.entries(ETICHETTE_CAUSALI_RESO).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
        </select>
        <input name="importo" type="number" min={0} step="0.01" placeholder="Importo €" className={`${inputCls} diottria`} />
        {tipo === "denaro" && (
          <select name="metodo_rimborso" defaultValue={metodi[0]?.nome ?? "Contanti"} className={inputCls} aria-label="metodo rimborso">
            {metodi.map((m) => (<option key={m.id} value={m.nome}>{m.nome}</option>))}
          </select>
        )}
        <input name="doc_origine_numero" placeholder="N° documento d'origine *" className={`${inputCls} f-mono`} />
        <input name="doc_origine_data" type="date" className={inputCls} aria-label="data documento origine" />
      </div>
      <input name="note" placeholder="Note" className={inputCls} />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className="rounded-xl bg-inchiostro px-4 py-2.5 text-sm font-semibold text-carta hover:bg-black disabled:opacity-50">{inCorso ? "…" : "Registra reso"}</button>
        <button type="button" onClick={() => setAperto(false)} className="rounded-xl border border-linea bg-white px-4 py-2.5 text-sm font-semibold text-inchiostro hover:bg-carta">Chiudi</button>
      </div>
    </form>
  );
}
