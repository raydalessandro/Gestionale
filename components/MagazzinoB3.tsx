"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Boxes, ClipboardCheck, PackageCheck, ShieldAlert } from "lucide-react";
import {
  avanzaPraticaDifetto,
  chiudiBollaAttesa,
  creaBollaAttesaManuale,
  creaModelloLac,
  creaPraticaDifetto,
  riceviRigaBolla,
} from "@/lib/actions";
import { Errore, inputCls } from "@/components/ui";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primary = "bg-inchiostro text-carta hover:bg-black";
const accent = "bg-ottone text-white hover:bg-ottone-scuro";
const ghost = "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta";

type RigaBolla = {
  id: string;
  prodotto_id: string | null;
  descrizione: string;
  upc: string | null;
  q_attesa: number;
  q_caricata: number;
};

type Bolla = {
  id: string;
  fornitore: string;
  riferimento_interno: string | null;
  numero_bolla: string | null;
  lettera_vettura: string | null;
  stato: string;
  chiusa_il: string | null;
  chiusura_nota: string | null;
  righe: RigaBolla[];
};

type Pratica = {
  id: string;
  fornitore: string;
  descrizione: string;
  proprieta: string;
  stato: string;
  esito: string | null;
  foto_refs: string[];
};

type Prodotto = { id: string; nome: string; marca: string | null; tipo: string };

export function PannelloCatalogoB3() {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaModelloLac, null);
  return (
    <section className="rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Catalogo LAC</p>
          <h2 className="mt-1 text-lg font-semibold text-inchiostro">Famiglie e producibilità</h2>
          <p className="mt-1 text-sm text-soft">Il modello descrive la famiglia; le varianti fisiche nascono soltanto quando entrano a stock.</p>
        </div>
        <button type="button" className={`${btn} ${accent}`} onClick={() => setAperto((v) => !v)}>
          <Boxes size={16} /> {aperto ? "Chiudi" : "Codifica famiglia"}
        </button>
      </div>
      {aperto && (
        <form action={run} className="mt-5 space-y-3 border-t border-linea pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input name="fornitore" required placeholder="Fornitore *" className={inputCls} />
            <input name="nome" required placeholder="Nome famiglia *" className={inputCls} />
            <select name="tipologia" required defaultValue="monofocale" className={inputCls}>
              <option value="monofocale">Monofocale</option><option value="multifocale">Multifocale</option><option value="rigida">Rigida</option><option value="semirigida">Semirigida</option><option value="specialistica">Specialistica</option>
            </select>
            <select name="durata" required defaultValue="mensile" className={inputCls}>
              <option value="giornaliera">Giornaliera</option><option value="quindicinale">Quindicinale</option><option value="mensile">Mensile</option><option value="trimestrale">Trimestrale</option><option value="semestrale">Semestrale</option><option value="annuale">Annuale</option><option value="convenzionale">Convenzionale</option>
            </select>
            <input name="pezzi_per_confezione" type="number" min="1" defaultValue="1" className={inputCls} aria-label="Pezzi per confezione" />
            <input name="bc_disponibili" placeholder="BC disponibili, es. 8.4, 8.6" className={inputCls} />
            <input name="dia_disponibili" placeholder="DIA disponibili, es. 14.0, 14.2" className={inputCls} />
            <select name="geometria" defaultValue="" className={inputCls}><option value="">Geometria non indicata</option><option value="sferica">Sferica</option><option value="torica">Torica</option></select>
          </div>
          <textarea name="producibilita" rows={3} className={inputCls} placeholder={'Schema producibilità JSON, es. {"sfero":{"regole":[{"min":-6,"max":6,"step":0.25}]}}'} />
          <textarea name="upc_mappa" rows={2} className={inputCls} placeholder='Mappa UPC JSON opzionale' />
          <label className="flex items-center gap-2 text-sm text-soft"><input name="campioni" type="checkbox" /> Disponibile per campioni</label>
          <Errore msg={stato?.errore} />
          <p className="text-xs text-faint">La producibilità genera avvisi e non blocca mai l’operatore.</p>
          <button type="submit" disabled={inCorso} className={`${btn} ${primary}`}>{inCorso ? "Salvo…" : "Salva famiglia"}</button>
        </form>
      )}
    </section>
  );
}

export function RicevimentoB3({ bolle, prodotti }: { bolle: Bolla[]; prodotti: Prodotto[] }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Ricevimento</p>
        <h2 className="mt-1 text-lg font-semibold text-inchiostro">Bolle attese e differenze</h2>
        <p className="mt-1 text-sm text-soft">Il carico nasce solo dal ricevimento della riga; la bolla attesa non modifica mai la giacenza.</p>
      </div>
      <FormBollaAttesaManuale prodotti={prodotti} />
      {bolle.length === 0 ? <p className="rounded-xl border border-dashed border-linea bg-carta p-5 text-sm text-faint">Nessuna bolla attesa aperta. Le bolle da ordine saranno generate dal flusso B4 alla conferma fiscale.</p> : bolle.map((bolla) => <SchedaBolla key={bolla.id} bolla={bolla} />)}
    </section>
  );
}

function FormBollaAttesaManuale({ prodotti }: { prodotti: Prodotto[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaBollaAttesaManuale, null);
  return <section className="rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-inchiostro">Bolla attesa manuale</p><p className="mt-1 text-xs text-faint">Per forniture fuori dall’ordine cliente; il trigger post-conferma resta B4.</p></div>
      <button type="button" className={`${btn} ${accent}`} onClick={() => setAperto((v) => !v)}>{aperto ? "Chiudi" : "Nuova bolla attesa"}</button>
    </div>
    {aperto && <form action={run} className="mt-4 grid gap-3 border-t border-linea pt-4 md:grid-cols-2">
      <input name="fornitore" required placeholder="Fornitore *" className={inputCls} />
      <input name="numero_bolla" placeholder="N° bolla" className={inputCls} />
      <input name="lettera_vettura" placeholder="Lettera di vettura" className={inputCls} />
      <input name="riferimento_interno" placeholder="Riferimento interno" className={inputCls} />
      <select name="prodotto_id" required defaultValue="" aria-label="Prodotto riga bolla" className={inputCls}><option value="">Prodotto fisico *</option>{prodotti.map((p) => <option key={p.id} value={p.id}>{p.marca ? `${p.marca} · ` : ""}{p.nome}</option>)}</select>
      <input name="quantita" type="number" min="1" required placeholder="Quantità attesa *" className={inputCls} />
      <div className="md:col-span-2"><Errore msg={stato?.errore} /><button type="submit" disabled={inCorso} className={`${btn} ${primary}`}>{inCorso ? "Salvo…" : "Crea bolla attesa"}</button></div>
    </form>}
  </section>;
}

function SchedaBolla({ bolla }: { bolla: Bolla }) {
  const differenza = bolla.righe.some((r) => r.q_attesa !== r.q_caricata);
  return (
    <article className="rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold text-inchiostro">{bolla.fornitore}</h3><p className="mt-1 text-sm text-soft">{bolla.riferimento_interno ?? "Senza riferimento interno"} · Bolla {bolla.numero_bolla ?? "da registrare"}</p></div>
        <span className="rounded-full bg-carta px-3 py-1 text-xs font-semibold text-soft">{bolla.stato}</span>
      </div>
      <div className="mt-4 space-y-3">{bolla.righe.map((riga) => <RigaRicevimento key={riga.id} riga={riga} disabilitata={bolla.stato === "annullata"} />)}</div>
      {differenza && !bolla.chiusa_il && <FormChiudiBolla bollaId={bolla.id} />}
      {bolla.chiusura_nota && <p className="mt-4 rounded-lg bg-carta p-3 text-sm text-soft">Differenza chiusa: {bolla.chiusura_nota}</p>}
    </article>
  );
}

function RigaRicevimento({ riga, disabilitata }: { riga: RigaBolla; disabilitata: boolean }) {
  const azione = riceviRigaBolla.bind(null, riga.id);
  const [stato, run, inCorso] = useActionState(azione, null);
  const daConfermare = riga.q_attesa - riga.q_caricata;
  return <form action={run} className="grid items-end gap-2 rounded-xl bg-carta p-3 md:grid-cols-[1fr_auto_auto_auto]">
    <div><p className="text-sm font-medium text-inchiostro">{riga.descrizione}</p><p className="mt-1 text-xs text-faint">Attesa {riga.q_attesa} · confermata {riga.q_caricata} · da confermare {daConfermare}</p></div>
    <input name="quantita" type="number" min="1" defaultValue={Math.max(1, daConfermare)} disabled={!riga.prodotto_id || disabilitata} className={`${inputCls} w-24`} aria-label={`Quantità ricevuta ${riga.descrizione}`} />
    <button type="submit" disabled={inCorso || !riga.prodotto_id || disabilitata} className={`${btn} ${primary}`}><PackageCheck size={16} /> {inCorso ? "…" : "Ricevi"}</button>
    <Errore msg={stato?.errore} />
    {!riga.prodotto_id && <p className="text-xs text-rosso md:col-span-4">Codifica prima la variante fisica per ricevere questa riga.</p>}
  </form>;
}

function FormChiudiBolla({ bollaId }: { bollaId: string }) {
  const azione = chiudiBollaAttesa.bind(null, bollaId);
  const [stato, run, inCorso] = useActionState(azione, null);
  return <form action={run} className="mt-4 flex flex-wrap gap-2 rounded-xl border border-ottone/30 bg-ottone-soft/20 p-3">
    <AlertTriangle size={16} className="mt-2 text-ottone-scuro" />
    <input name="chiusura_nota" required placeholder="Motivo chiusura differenza (arrivata dopo, resa, rigenerata…)" className={`${inputCls} min-w-64 flex-1`} />
    <button type="submit" disabled={inCorso} className={`${btn} ${ghost}`}>{inCorso ? "…" : "Chiudi differenza"}</button>
    <Errore msg={stato?.errore} />
  </form>;
}

export function DifettiB3({ pratiche, prodotti }: { pratiche: Pratica[]; prodotti: Prodotto[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(creaPraticaDifetto, null);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-faint">Conformità</p><h2 className="mt-1 text-lg font-semibold text-inchiostro">Pratiche difetto</h2></div><button type="button" className={`${btn} ${accent}`} onClick={() => setAperto((v) => !v)}><ShieldAlert size={16} /> {aperto ? "Chiudi" : "Apri pratica"}</button></div>
    {aperto && <form action={run} className="space-y-3 rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <div className="grid gap-3 md:grid-cols-2"><input name="fornitore" required placeholder="Fornitore *" className={inputCls} /><select name="proprieta" required defaultValue="cliente" aria-label="Proprietà pratica difetto" className={inputCls}><option value="cliente">Bene del cliente</option><option value="esposizione">Bene di esposizione</option></select><select name="prodotto_id" defaultValue="" aria-label="Prodotto pratica difetto" className={inputCls}><option value="">Prodotto non codificato</option>{prodotti.map((p) => <option key={p.id} value={p.id}>{p.marca ? `${p.marca} · ` : ""}{p.nome}</option>)}</select><input name="upc" placeholder="UPC / EAN" className={inputCls} /></div>
      <textarea name="descrizione" required rows={3} placeholder="Descrizione del difetto *" className={inputCls} /><textarea name="foto_refs" rows={2} placeholder="Riferimenti foto, uno per riga" className={inputCls} /><textarea name="accordi_note" rows={2} placeholder="Accordi con il fornitore" className={inputCls} />
      <Errore msg={stato?.errore} /><button type="submit" disabled={inCorso} className={`${btn} ${primary}`}>{inCorso ? "Apro…" : "Apri pratica"}</button>
    </form>}
    {pratiche.map((pratica) => <SchedaPratica key={pratica.id} pratica={pratica} />)}
  </section>;
}

function SchedaPratica({ pratica }: { pratica: Pratica }) {
  const azione = avanzaPraticaDifetto.bind(null, pratica.id);
  const [stato, run, inCorso] = useActionState(azione, null);
  const prossimi = pratica.stato === "aperta" ? ["riconosciuta", "respinta"] : pratica.stato === "chiusa" ? [] : ["chiusa"];
  return <article className="rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)]"><div className="flex justify-between gap-3"><div><h3 className="font-semibold text-inchiostro">{pratica.fornitore} · {pratica.proprieta}</h3><p className="mt-1 text-sm text-soft">{pratica.descrizione}</p></div><span className="rounded-full bg-carta px-3 py-1 text-xs font-semibold text-soft">{pratica.stato}</span></div>{pratica.foto_refs.length > 0 && <p className="mt-3 text-xs text-faint">{pratica.foto_refs.length} foto-reference registrate</p>}{prossimi.length > 0 && <form action={run} className="mt-4 flex flex-wrap gap-2"><select name="stato" defaultValue={prossimi[0]} aria-label="Stato pratica difetto" className={inputCls}>{prossimi.map((s) => <option key={s} value={s}>{s}</option>)}</select>{pratica.stato === "aperta" && <select name="esito" defaultValue="sostituzione" aria-label="Esito pratica difetto" className={inputCls}><option value="sostituzione">Sostituzione</option><option value="rimborso">Rimborso</option><option value="respinto">Respinto</option></select>}<button type="submit" disabled={inCorso} className={`${btn} ${ghost}`}><ClipboardCheck size={16} /> {inCorso ? "…" : "Aggiorna"}</button><Errore msg={stato?.errore} /></form>}</article>;
}
