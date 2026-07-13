"use client";

import { useActionState, useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  registraEsitoRichiamo,
  registraEsitoProposta,
  creaRichiamo,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { inputCls, Errore } from "@/components/ui";
import { CANALI_RICHIAMO, ESITI_RICHIAMO, TIPI_RICHIAMO } from "@/lib/utils";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const stili = {
  primary: "bg-inchiostro text-carta hover:bg-black",
  accent: "bg-ottone text-white hover:bg-ottone-scuro",
  ghost: "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta",
} as const;

/** Campi comuni canale/esito/valore/note (§2.6). */
function CampiEsito({ valore }: { valore: number | null }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="canale" defaultValue="" required className={inputCls} aria-label="canale del richiamo">
          <option value="" disabled>Canale…</option>
          {Object.entries(CANALI_RICHIAMO).map(([id, l]) => (
            <option key={id} value={id}>{l}</option>
          ))}
        </select>
        <select name="esito" defaultValue="" required className={inputCls} aria-label="esito del richiamo">
          <option value="" disabled>Esito…</option>
          {Object.entries(ESITI_RICHIAMO).map(([id, l]) => (
            <option key={id} value={id}>{l}</option>
          ))}
        </select>
        <input name="valore" type="number" step="0.01" min={0} defaultValue={valore ?? ""} placeholder="Valore €" className={`${inputCls} diottria`} />
        <input name="note" placeholder="Note (facoltative)" className={inputCls} />
      </div>
      <p className="text-[11px] text-faint">
        Esito &quot;Appuntamento fissato&quot; ti porta in agenda già compilata.
      </p>
    </>
  );
}

export function RegistraEsito({ id, valore }: { id: string; valore: number | null }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(registraEsitoRichiamo.bind(null, id), null);
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className={`${btn} ${stili.primary}`}>
        Registra esito
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea bg-carta p-3">
      <CampiEsito valore={valore} />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>{inCorso ? "…" : "Salva esito"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} ${stili.ghost}`}>Chiudi</button>
      </div>
    </form>
  );
}

type PropostaMini = {
  tipo: string;
  cliente_id: string;
  riferimento: string | null;
  valore: number | null;
};

export function EsitoProposta({ proposta }: { proposta: PropostaMini }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(registraEsitoProposta, null);
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className={`${btn} ${stili.primary}`}>
        Registra esito
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea bg-carta p-3">
      <input type="hidden" name="tipo" value={proposta.tipo} />
      <input type="hidden" name="cliente_id" value={proposta.cliente_id} />
      <input type="hidden" name="riferimento" value={proposta.riferimento ?? ""} />
      <CampiEsito valore={proposta.valore} />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>{inCorso ? "…" : "Salva esito"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} ${stili.ghost}`}>Chiudi</button>
      </div>
    </form>
  );
}

export function PianificaProposta({ proposta }: { proposta: PropostaMini }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaRichiamo, null);
  const [oggi] = useState(() => new Date().toISOString().slice(0, 10));
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className={`${btn} ${stili.ghost}`}>
        Pianifica
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea bg-carta p-3">
      <input type="hidden" name="tipo" value={proposta.tipo} />
      <input type="hidden" name="cliente_id" value={proposta.cliente_id} />
      <input type="hidden" name="riferimento" value={proposta.riferimento ?? ""} />
      <input type="hidden" name="valore" value={proposta.valore ?? ""} />
      <div className="flex items-center gap-2">
        <label className="text-xs text-soft">Da fare il</label>
        <input name="da_fare_il" type="date" defaultValue={oggi} className={inputCls} />
      </div>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>{inCorso ? "…" : "Metti in coda"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} ${stili.ghost}`}>Chiudi</button>
      </div>
    </form>
  );
}

export function Ripianifica({ proposta }: { proposta: PropostaMini }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaRichiamo, null);
  const [piu3] = useState(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className={`${btn} ${stili.ghost}`}>
        Ripianifica
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea bg-carta p-3">
      <input type="hidden" name="tipo" value={proposta.tipo} />
      <input type="hidden" name="cliente_id" value={proposta.cliente_id} />
      <input type="hidden" name="riferimento" value={proposta.riferimento ?? ""} />
      <input type="hidden" name="valore" value={proposta.valore ?? ""} />
      <div className="flex items-center gap-2">
        <label className="text-xs text-soft">Richiama di nuovo il</label>
        <input name="da_fare_il" type="date" defaultValue={piu3} className={inputCls} aria-label="data ripianificazione" />
      </div>
      <p className="text-[11px] text-faint">Crea un nuovo richiamo: la riga di oggi resta nello storico.</p>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>{inCorso ? "…" : "Ripianifica"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} ${stili.ghost}`}>Chiudi</button>
      </div>
    </form>
  );
}

type ClienteMini = { id: string; nome: string; cognome: string };

export function NuovoRichiamo() {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaRichiamo, null);
  const supabase = createClient();
  const [cliente, setCliente] = useState<ClienteMini | null>(null);
  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);
  const [oggi] = useState(() => new Date().toISOString().slice(0, 10));

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
    return (
      <button type="button" onClick={() => setAperto(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-ottone px-4 py-2.5 text-sm font-semibold text-white hover:bg-ottone-scuro">
        Nuovo richiamo
      </button>
    );
  }
  return (
    <form action={run} className="space-y-2 rounded-xl border border-linea bg-white p-3">
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
      {cliente ? (
        <div className="flex items-center justify-between rounded-xl border border-linea bg-carta px-3 py-2">
          <span className="text-sm font-semibold text-inchiostro">{cliente.cognome} {cliente.nome}</span>
          <button type="button" onClick={() => setCliente(null)} className="text-xs font-semibold text-ottone-scuro hover:underline">Cambia</button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cerca cliente…" className={`${inputCls} !pl-9`} />
          {risultati.length > 0 && (
            <div className="mt-1 divide-y divide-linea rounded-xl border border-linea bg-white">
              {risultati.map((c) => (
                <button key={c.id} type="button" onClick={() => { setCliente(c); setTerm(""); setRisultati([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-carta">{c.cognome} {c.nome}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select name="tipo" defaultValue="generico" className={inputCls} aria-label="tipo di richiamo">
          {Object.entries(TIPI_RICHIAMO).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
        </select>
        <input name="da_fare_il" type="date" defaultValue={oggi} className={inputCls} />
        <input name="riferimento" className={`${inputCls} f-mono`} placeholder="Riferimento (facoltativo)" />
        <input name="note" className={inputCls} placeholder="Note" />
      </div>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso || !cliente} className={`${btn} ${stili.primary}`}>{inCorso ? "…" : "Crea richiamo"}</button>
        <button type="button" onClick={() => setAperto(false)} className={`${btn} ${stili.ghost}`}>Chiudi</button>
      </div>
    </form>
  );
}
