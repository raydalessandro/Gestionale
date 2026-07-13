"use client";

import { useActionState, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { creaAppuntamento } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { TIPI_APPUNTAMENTO } from "@/lib/utils";

type ClienteMini = { id: string; nome: string; cognome: string };
type Utente = { id: string; nome: string };

export default function FormAppuntamento({
  clientePreselezionato,
  utenti,
  utenteCorrente,
  prefill,
}: {
  clientePreselezionato: ClienteMini | null;
  utenti: Utente[];
  utenteCorrente: string;
  prefill: { tipo?: string; riferimento?: string; data?: string };
}) {
  const [stato, run, inCorso] = useActionState(creaAppuntamento, null);
  const supabase = createClient();

  const [cliente, setCliente] = useState<ClienteMini | null>(clientePreselezionato);
  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);
  const [oggi] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (cliente || term.trim().length < 2) {
      setRisultati([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = term.trim().replace(/[%,]/g, "");
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome")
        .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%`)
        .limit(8);
      setRisultati(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [term, cliente, supabase]);

  const tipoDefault = prefill.tipo && prefill.tipo in TIPI_APPUNTAMENTO ? prefill.tipo : "controllo_vista";

  return (
    <form action={run} className="space-y-4">
      <Errore msg={stato?.errore} />
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />

      <Card className="space-y-4">
        <Field label="Cliente" hint="Facoltativo — senza cliente è un impegno interno.">
          {cliente ? (
            <div className="flex items-center justify-between rounded-xl border border-linea bg-white px-3 py-2">
              <span className="text-sm font-semibold text-inchiostro">
                {cliente.cognome} {cliente.nome}
              </span>
              <button type="button" onClick={() => setCliente(null)} className="text-xs font-semibold text-ottone-scuro hover:underline">
                Cambia
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cerca cliente…" className={`${inputCls} !pl-10`} />
              {risultati.length > 0 && (
                <div className="mt-1 divide-y divide-linea rounded-xl border border-linea bg-white">
                  {risultati.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCliente(c); setTerm(""); setRisultati([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-carta">
                      {c.cognome} {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select name="tipo" defaultValue={tipoDefault} className={inputCls}>
              {Object.entries(TIPI_APPUNTAMENTO).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Con chi">
            <select name="utente_id" defaultValue={utenteCorrente} className={inputCls}>
              {utenti.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </Field>
          <Field label="Giorno">
            <input name="data" type="date" defaultValue={prefill.data || oggi} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ora">
              <input name="ora" type="time" step={300} className={inputCls} defaultValue="10:00" />
            </Field>
            <Field label="Durata (min)">
              <input name="durata_minuti" type="number" min={5} max={240} step={5} defaultValue={20} className={`${inputCls} diottria`} />
            </Field>
          </div>
        </div>

        <Field label="Riferimento" hint="Numero ordine o busta, se collegato.">
          <input name="riferimento" className={`${inputCls} f-mono`} defaultValue={prefill.riferimento ?? ""} placeholder="BL-2026-0001" />
        </Field>
        <Field label="Note">
          <textarea name="note" rows={2} className={inputCls} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <button type="submit" disabled={inCorso} className="rounded-xl bg-ottone px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50">
          {inCorso ? "Salvo…" : "Salva appuntamento"}
        </button>
      </div>
    </form>
  );
}
