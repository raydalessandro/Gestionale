"use client";

import { useActionState, useEffect, useState } from "react";
import { PackagePlus, SlidersHorizontal, Minus, BookmarkPlus, Search } from "lucide-react";
import {
  caricoDaBolla,
  registraMovimento,
  creaFermo,
  eventoFermo,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { inputCls, Errore } from "@/components/ui";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const stili = {
  primary: "bg-inchiostro text-carta hover:bg-black",
  accent: "bg-ottone text-white hover:bg-ottone-scuro",
  ghost: "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta",
  danger: "border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft",
} as const;

/** Contenitore a pannelli: un solo form aperto per volta. */
export function AzioniProdotto({
  prodottoId,
  disponibile,
}: {
  prodottoId: string;
  disponibile: number;
}) {
  const [aperto, setAperto] = useState<string | null>(null);
  const toggle = (k: string) => setAperto((a) => (a === k ? null : k));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => toggle("carico")} className={`${btn} ${stili.primary}`}>
          <PackagePlus size={16} /> Carico da bolla
        </button>
        <button type="button" onClick={() => toggle("rettifica")} className={`${btn} ${stili.ghost}`}>
          <SlidersHorizontal size={16} /> Rettifica
        </button>
        <button type="button" onClick={() => toggle("altro")} className={`${btn} ${stili.ghost}`}>
          <Minus size={16} /> Altro movimento
        </button>
        <button type="button" onClick={() => toggle("fermo")} className={`${btn} ${stili.ghost}`}>
          <BookmarkPlus size={16} /> Nuovo fermo
        </button>
      </div>

      {aperto === "carico" && <FormCarico prodottoId={prodottoId} onFatto={() => setAperto(null)} />}
      {aperto === "rettifica" && <FormRettifica prodottoId={prodottoId} onFatto={() => setAperto(null)} />}
      {aperto === "altro" && <FormAltro prodottoId={prodottoId} onFatto={() => setAperto(null)} />}
      {aperto === "fermo" && (
        <FormFermo prodottoId={prodottoId} disponibile={disponibile} onFatto={() => setAperto(null)} />
      )}
    </div>
  );
}

function Pannello({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-linea bg-carta p-3">{children}</div>;
}

function FormCarico({ prodottoId, onFatto }: { prodottoId: string; onFatto: () => void }) {
  const azione = caricoDaBolla.bind(null, prodottoId);
  const [stato, run, inCorso] = useActionState(azione, null);
  const [bolla, setBolla] = useState("");
  return (
    <Pannello>
      <form action={run} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Carico da bolla</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="bolla" value={bolla} onChange={(e) => setBolla(e.target.value)} placeholder="N° bolla" className={inputCls} />
          <input name="qta_bolla" type="number" min={1} step={1} placeholder="Q.tà in bolla" className={`${inputCls} diottria`} />
          <input name="qta_contata" type="number" min={0} step={1} placeholder="Q.tà contata" className={`${inputCls} diottria`} />
        </div>
        <Errore msg={stato?.errore} />
        <div className="flex gap-2">
          <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>
            {inCorso ? "…" : "Registra carico"}
          </button>
          <button type="button" onClick={onFatto} className={`${btn} ${stili.ghost}`}>Chiudi</button>
        </div>
        <p className="text-[11px] text-faint">
          Se il contato differisce dalla bolla si registra in automatico una rettifica con la differenza.
        </p>
      </form>
    </Pannello>
  );
}

function FormRettifica({ prodottoId, onFatto }: { prodottoId: string; onFatto: () => void }) {
  const azione = registraMovimento.bind(null, prodottoId);
  const [stato, run, inCorso] = useActionState(azione, null);
  return (
    <Pannello>
      <form action={run} className="space-y-3">
        <input type="hidden" name="tipo" value="rettifica" />
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Rettifica manuale</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select name="direzione" className={inputCls} defaultValue="+" aria-label="direzione rettifica">
            <option value="+">Aumenta (+)</option>
            <option value="-">Diminuisci (−)</option>
          </select>
          <input name="quantita" type="number" min={1} step={1} placeholder="Quantità" className={`${inputCls} diottria`} />
          <input name="motivo" placeholder="Motivo (obbligatorio)" className={`${inputCls} sm:col-span-1`} />
        </div>
        <Errore msg={stato?.errore} />
        <div className="flex gap-2">
          <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>
            {inCorso ? "…" : "Registra rettifica"}
          </button>
          <button type="button" onClick={onFatto} className={`${btn} ${stili.ghost}`}>Chiudi</button>
        </div>
      </form>
    </Pannello>
  );
}

function FormAltro({ prodottoId, onFatto }: { prodottoId: string; onFatto: () => void }) {
  const azione = registraMovimento.bind(null, prodottoId);
  const [stato, run, inCorso] = useActionState(azione, null);
  return (
    <Pannello>
      <form action={run} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Altro movimento (scarico)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select name="tipo" className={inputCls} defaultValue="scarico" aria-label="tipo movimento">
            <option value="scarico">Scarico</option>
            <option value="reso_fornitore">Reso a fornitore</option>
            <option value="danno">Danno / smaltimento</option>
            <option value="uso_interno">Uso interno</option>
          </select>
          <input name="quantita" type="number" min={1} step={1} placeholder="Quantità" className={`${inputCls} diottria`} />
          <input name="motivo" placeholder="Riferimento / motivo" className={inputCls} />
        </div>
        <Errore msg={stato?.errore} />
        <div className="flex gap-2">
          <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>
            {inCorso ? "…" : "Registra movimento"}
          </button>
          <button type="button" onClick={onFatto} className={`${btn} ${stili.ghost}`}>Chiudi</button>
        </div>
      </form>
    </Pannello>
  );
}

type ClienteMini = { id: string; nome: string; cognome: string };

function FormFermo({
  prodottoId,
  disponibile,
  onFatto,
}: {
  prodottoId: string;
  disponibile: number;
  onFatto: () => void;
}) {
  const azione = creaFermo.bind(null, prodottoId);
  const [stato, run, inCorso] = useActionState(azione, null);
  const supabase = createClient();

  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);
  const [cliente, setCliente] = useState<ClienteMini | null>(null);
  const [scadenza] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

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

  return (
    <Pannello>
      <form action={run} className="space-y-3">
        <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Nuovo fermo · disponibili {disponibile}
        </p>

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
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCliente(c);
                      setTerm("");
                      setRisultati([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-carta"
                  >
                    {c.cognome} {c.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="quantita" type="number" min={1} step={1} defaultValue={1} placeholder="Quantità" className={`${inputCls} diottria`} />
          <input name="scade_il" type="date" defaultValue={scadenza} className={inputCls} />
        </div>
        <input name="note" placeholder="Note (facoltative)" className={inputCls} />
        <Errore msg={stato?.errore} />
        <div className="flex gap-2">
          <button type="submit" disabled={inCorso || !cliente} className={`${btn} ${stili.primary}`}>
            {inCorso ? "…" : "Metti da parte"}
          </button>
          <button type="button" onClick={onFatto} className={`${btn} ${stili.ghost}`}>Chiudi</button>
        </div>
      </form>
    </Pannello>
  );
}

/** Azioni inline su un fermo attivo (ritira / annulla). */
export function AzioniFermo({ id }: { id: string }) {
  const [statoR, runR, inCorsoR] = useActionState(eventoFermo.bind(null, id, "ritira"), null);
  const [statoA, runA, inCorsoA] = useActionState(eventoFermo.bind(null, id, "annulla"), null);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <form action={runR}>
          <button type="submit" disabled={inCorsoR} className="rounded-lg bg-inchiostro px-3 py-1.5 text-xs font-semibold text-carta hover:bg-black disabled:opacity-50">
            {inCorsoR ? "…" : "Segna ritirato"}
          </button>
        </form>
        <form action={runA}>
          <button type="submit" disabled={inCorsoA} className="rounded-lg border border-linea bg-white px-3 py-1.5 text-xs font-semibold text-soft hover:bg-carta disabled:opacity-50">
            {inCorsoA ? "…" : "Annulla"}
          </button>
        </form>
      </div>
      <Errore msg={statoR?.errore ?? statoA?.errore} />
    </div>
  );
}
