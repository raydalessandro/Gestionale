"use client";

import { useActionState, useEffect, useState } from "react";
import { Search, Trash2, Plus, PackageSearch } from "lucide-react";
import { creaVendita, incassaConsegna } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { ALIQUOTA_DA_TIPO, ivaScorporo } from "@/components/CassaUI";
import { fmtEuro, ETICHETTE_ALIQUOTA } from "@/lib/utils";

type ClienteMini = { id: string; nome: string; cognome: string; codice_fiscale?: string | null };
type Metodo = { id: string; nome: string; tipo: string };
export type RigaV = {
  prodotto_id: string | null;
  descrizione: string;
  quantita: string;
  prezzo_unitario: string;
  sconto: string;
  aliquota: "4" | "22" | "esente";
  dm: boolean;
};
export type PagV = { metodo_id: string | null; nome: string; importo: string; consegnato: string };

const rigaVuota: RigaV = { prodotto_id: null, descrizione: "", quantita: "1", prezzo_unitario: "0", sconto: "0", aliquota: "22", dm: false };

function nn(s: string): number {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

export default function WizardVendita({
  clientePreselezionato,
  metodi,
  righeIniziali,
  pagamentiIniziali,
  cfIniziale,
  consegna,
}: {
  clientePreselezionato: ClienteMini | null;
  metodi: Metodo[];
  righeIniziali?: RigaV[];
  pagamentiIniziali?: PagV[];
  cfIniziale?: string | null;
  consegna?: { tipo: "busta" | "lac"; id: string } | null;
}) {
  const azione = consegna ? incassaConsegna.bind(null, consegna.tipo, consegna.id) : creaVendita;
  const [stato, run, inCorso] = useActionState(azione, null);
  const supabase = createClient();

  const [cliente, setCliente] = useState<ClienteMini | null>(clientePreselezionato);
  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);
  const [righe, setRighe] = useState<RigaV[]>(righeIniziali?.length ? righeIniziali : [{ ...rigaVuota }]);
  const [pagamenti, setPagamenti] = useState<PagV[]>(
    pagamentiIniziali?.length ? pagamentiIniziali : [{ metodo_id: null, nome: "", importo: "0", consegnato: "" }]
  );
  const [riallineamento, setRiall] = useState(false);
  const [catAperto, setCatAperto] = useState(false);
  const [catTerm, setCatTerm] = useState("");
  const [catRis, setCatRis] = useState<{ id: string; marca: string | null; nome: string; prezzo: number; tipo: string }[]>([]);

  useEffect(() => {
    if (cliente || term.trim().length < 2) { setRisultati([]); return; }
    const t = setTimeout(async () => {
      const q = term.trim().replace(/[%,]/g, "");
      const { data } = await supabase.from("clienti").select("id, nome, cognome, codice_fiscale").or(`nome.ilike.%${q}%,cognome.ilike.%${q}%`).limit(8);
      setRisultati(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [term, cliente, supabase]);

  useEffect(() => {
    if (!catAperto || catTerm.trim().length < 2) { setCatRis([]); return; }
    const t = setTimeout(async () => {
      const q = catTerm.trim().replace(/[%,]/g, "");
      const { data } = await supabase.from("prodotti").select("id, marca, nome, prezzo, tipo").eq("attivo", true).or(`nome.ilike.%${q}%,marca.ilike.%${q}%,sku.ilike.%${q}%`).limit(8);
      setCatRis(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [catTerm, catAperto, supabase]);

  const totale = righe.reduce((s, r) => s + Math.max(0, nn(r.quantita) * nn(r.prezzo_unitario) - nn(r.sconto)), 0);
  const iva = righe.reduce((s, r) => s + ivaScorporo(Math.max(0, nn(r.quantita) * nn(r.prezzo_unitario) - nn(r.sconto)), r.aliquota), 0);
  const sommaPag = pagamenti.reduce((s, p) => s + nn(p.importo), 0);
  const quadra = Math.abs(sommaPag - totale) < 0.01;

  const righeJson = JSON.stringify(
    righe.map((r) => ({ prodotto_id: r.prodotto_id, descrizione: r.descrizione, quantita: nn(r.quantita), prezzo_unitario: nn(r.prezzo_unitario), sconto: nn(r.sconto), aliquota: r.aliquota, dm: r.dm }))
  );
  const pagamentiJson = JSON.stringify(
    pagamenti.filter((p) => nn(p.importo) > 0).map((p) => ({ metodo_id: p.metodo_id, nome: p.nome || "Pagamento", importo: nn(p.importo) }))
  );

  const setRiga = (i: number, patch: Partial<RigaV>) => setRighe((rr) => rr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setPag = (i: number, patch: Partial<PagV>) => setPagamenti((pp) => pp.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function daCatalogo(p: { id: string; marca: string | null; nome: string; prezzo: number; tipo: string }) {
    const def = ALIQUOTA_DA_TIPO[p.tipo as keyof typeof ALIQUOTA_DA_TIPO] ?? { aliquota: "22" as const, dm: false };
    setRighe((rr) => [
      ...rr.filter((r) => r.descrizione.trim() !== "" || r.prodotto_id),
      { ...rigaVuota, prodotto_id: p.id, descrizione: [p.marca, p.nome].filter(Boolean).join(" "), prezzo_unitario: String(p.prezzo), aliquota: def.aliquota, dm: def.dm },
    ]);
    setCatAperto(false); setCatTerm(""); setCatRis([]);
  }

  const righeValide = righe.length > 0 && righe.every((r) => r.descrizione.trim() !== "");

  return (
    <form action={run} className="space-y-4">
      <Errore msg={stato?.errore} />
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
      <input type="hidden" name="righe" value={righeJson} />
      <input type="hidden" name="pagamenti" value={pagamentiJson} />

      {/* Cliente */}
      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Cliente</p>
        {cliente ? (
          <div className="flex items-center justify-between rounded-xl border border-linea bg-white px-3 py-2">
            <span className="text-sm font-semibold text-inchiostro">{cliente.cognome} {cliente.nome}</span>
            {!consegna && <button type="button" onClick={() => setCliente(null)} className="text-xs font-semibold text-ottone-scuro hover:underline">Cambia</button>}
          </div>
        ) : (
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cerca cliente (facoltativo — vuoto = Non associato)…" className={`${inputCls} !pl-10`} />
            {risultati.length > 0 && (
              <div className="mt-1 divide-y divide-linea rounded-xl border border-linea bg-white">
                {risultati.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCliente(c); setTerm(""); setRisultati([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-carta">{c.cognome} {c.nome}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Righe */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Righe</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCatAperto((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${catAperto ? "border-inchiostro bg-inchiostro text-carta" : "border-ottone bg-ottone-soft text-ottone-scuro"}`}>
              <PackageSearch size={13} /> Da catalogo
            </button>
            <button type="button" onClick={() => setRighe((r) => [...r, { ...rigaVuota }])} className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white px-3 py-1 text-xs font-medium text-soft hover:border-faint hover:text-inchiostro">
              <Plus size={13} /> Aggiungi riga
            </button>
          </div>
        </div>

        {catAperto && (
          <div className="rounded-xl border border-linea bg-carta p-3">
            <input value={catTerm} onChange={(e) => setCatTerm(e.target.value)} placeholder="Cerca prodotto a catalogo…" className={inputCls} />
            {catRis.length > 0 && (
              <div className="mt-2 divide-y divide-linea rounded-xl border border-linea bg-white">
                {catRis.map((p) => (
                  <button key={p.id} type="button" onClick={() => daCatalogo(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-carta">
                    <span className="truncate">{[p.marca, p.nome].filter(Boolean).join(" ")}</span>
                    <span className="shrink-0 text-xs text-faint">{fmtEuro(p.prezzo)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {righe.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-linea p-3">
            <div className="flex items-start gap-2">
              <input value={r.descrizione} onChange={(e) => setRiga(i, { descrizione: e.target.value })} placeholder="Descrizione" className={`${inputCls} flex-1`} />
              {righe.length > 1 && (
                <button type="button" onClick={() => setRighe((rr) => rr.filter((_, j) => j !== i))} className="mt-1 shrink-0 text-faint hover:text-rosso" aria-label="Rimuovi riga"><Trash2 size={16} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input type="number" min={1} step={1} value={r.quantita} onChange={(e) => setRiga(i, { quantita: e.target.value })} placeholder="q.tà" className={`${inputCls} diottria`} aria-label="quantità" />
              <input type="number" min={0} step="0.01" value={r.prezzo_unitario} onChange={(e) => setRiga(i, { prezzo_unitario: e.target.value })} placeholder="prezzo" className={`${inputCls} diottria`} aria-label="prezzo unitario" />
              <input type="number" min={0} step="0.01" value={r.sconto} onChange={(e) => setRiga(i, { sconto: e.target.value })} placeholder="sconto" className={`${inputCls} diottria`} aria-label="sconto" />
              <select value={r.aliquota} onChange={(e) => setRiga(i, { aliquota: e.target.value as RigaV["aliquota"] })} className={inputCls} aria-label="aliquota">
                {Object.entries(ETICHETTE_ALIQUOTA).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-soft">
              <input type="checkbox" checked={r.dm} onChange={(e) => setRiga(i, { dm: e.target.checked })} className="h-4 w-4 accent-[#A67C42]" /> Dispositivo medico (DM)
            </label>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl bg-inchiostro px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-carta/70">Totale · di cui IVA {fmtEuro(iva)}</span>
          <span className="f-mono text-xl font-semibold tabular-nums text-carta">{fmtEuro(totale)}</span>
        </div>
      </Card>

      {/* Pagamenti */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Pagamenti</p>
          <button type="button" onClick={() => setPagamenti((p) => [...p, { metodo_id: null, nome: "", importo: "0", consegnato: "" }])} className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white px-3 py-1 text-xs font-medium text-soft hover:border-faint hover:text-inchiostro">
            <Plus size={13} /> Aggiungi
          </button>
        </div>
        {pagamenti.map((p, i) => {
          const isContanti = (metodi.find((m) => m.id === p.metodo_id)?.tipo ?? "") === "contanti" || p.nome.toLowerCase() === "contanti";
          const resto = isContanti && p.consegnato ? nn(p.consegnato) - nn(p.importo) : null;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <select
                  value={p.metodo_id ?? p.nome}
                  onChange={(e) => {
                    const m = metodi.find((x) => x.id === e.target.value);
                    setPag(i, m ? { metodo_id: m.id, nome: m.nome } : { metodo_id: null, nome: e.target.value });
                  }}
                  className={`${inputCls} flex-1`}
                  aria-label="metodo"
                >
                  <option value="" disabled>Metodo…</option>
                  {p.nome && !metodi.some((m) => m.id === p.metodo_id) && <option value={p.nome}>{p.nome}</option>}
                  {metodi.map((m) => (<option key={m.id} value={m.id}>{m.nome}</option>))}
                </select>
                <input type="number" min={0} step="0.01" value={p.importo} onChange={(e) => setPag(i, { importo: e.target.value })} placeholder="importo" className={`${inputCls} diottria w-28`} aria-label="importo" />
                {pagamenti.length > 1 && (
                  <button type="button" onClick={() => setPagamenti((pp) => pp.filter((_, j) => j !== i))} className="shrink-0 text-faint hover:text-rosso" aria-label="Rimuovi pagamento"><Trash2 size={16} /></button>
                )}
              </div>
              {isContanti && (
                <div className="flex items-center gap-2 pl-1 text-xs text-soft">
                  <span>Consegnato</span>
                  <input type="number" min={0} step="0.01" value={p.consegnato} onChange={(e) => setPag(i, { consegnato: e.target.value })} className={`${inputCls} diottria w-24 !py-1`} aria-label="consegnato" />
                  {resto !== null && <span className="font-semibold text-inchiostro">resto {fmtEuro(resto)}</span>}
                </div>
              )}
            </div>
          );
        })}
        <div className={`flex items-center justify-between rounded-xl border px-4 py-2 text-sm ${quadra ? "border-verde/40 bg-verde-soft text-verde" : "border-rosso/40 bg-rosso-soft text-rosso"}`}>
          <span>Pagato {fmtEuro(sommaPag)} su {fmtEuro(totale)}</span>
          <span className="font-semibold">{quadra ? "quadra" : `mancano ${fmtEuro(totale - sommaPag)}`}</span>
        </div>
      </Card>

      {/* Documento & riallineamento */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm font-semibold text-soft hover:text-inchiostro">+ Documento fiscale e opzioni</summary>
        <Card className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="N° documento (RT)"><input name="doc_numero" className={`${inputCls} f-mono`} placeholder="es. 1405-0006" /></Field>
            <Field label="Data documento"><input name="doc_data" type="date" className={inputCls} /></Field>
            <Field label="N° fattura"><input name="fattura_numero" className={inputCls} /></Field>
            <Field label="Codice fiscale cliente"><input name="cf_cliente" className={`${inputCls} f-mono uppercase`} defaultValue={cfIniziale ?? cliente?.codice_fiscale ?? ""} maxLength={16} /></Field>
          </div>
          <label className="flex items-start gap-3 text-sm text-inchiostro">
            <input type="checkbox" name="opposizione_ts" className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
            <span>Opposizione Sistema TS<span className="block text-xs text-faint">il documento non andrà trasmesso al Sistema TS.</span></span>
          </label>
          {!consegna && (
            <div className="rounded-xl border border-linea bg-carta p-3">
              <label className="flex items-start gap-3 text-sm text-inchiostro">
                <input type="checkbox" name="riallineamento" checked={riallineamento} onChange={(e) => setRiall(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
                <span>Vendita di riallineamento (emergenza)<span className="block text-xs text-faint">l'unico modo per retrodatare: richiede numero e data del documento emesso a mano.</span></span>
              </label>
              {riallineamento && (
                <Field label="Data vendita (passata)" className="mt-2"><input name="data_vendita" type="date" className={inputCls} /></Field>
              )}
            </div>
          )}
          <Field label="Note"><textarea name="note" rows={2} className={inputCls} /></Field>
        </Card>
      </details>

      <div className="flex justify-end">
        <button type="submit" disabled={inCorso || !righeValide || !quadra} className="rounded-xl bg-ottone px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50">
          {inCorso ? "Registro…" : consegna ? "Consegna e incassa" : "Registra vendita"}
        </button>
      </div>
    </form>
  );
}
