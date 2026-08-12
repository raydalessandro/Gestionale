"use client";

import { useActionState, useMemo, useState } from "react";
import { salvaSchedaUnica } from "@/lib/prescrizioni-actions";
import { calcolaIntermedio, calcolaOffice, calcolaScadenzaProposta, compensaDistanzaVertice } from "@/lib/prescrizioni-conversioni";
import { fmtDiottria, fmtRefrazione } from "@/lib/utils";
import { Card, Errore, Field, inputCls } from "@/components/ui";

type Occhio = { sfero: string; cilindro: string; asse: string; add: string; visus: string };
type Tipologia = "lontano" | "vicino" | "intermedio" | "bifocale" | "progressivo" | "progressiva" | "office" | "trifocale" | "mista";

const VUOTO: Occhio = { sfero: "", cilindro: "", asse: "", add: "", visus: "" };
const TIPI_OCCHIALI: { value: Tipologia; label: string }[] = [
  { value: "lontano", label: "Monofocale — lontano" },
  { value: "vicino", label: "Monofocale — vicino" },
  { value: "intermedio", label: "Monofocale — intermedio" },
  { value: "bifocale", label: "Bifocale" },
  { value: "progressiva", label: "Progressiva" },
  { value: "office", label: "Office" },
  { value: "trifocale", label: "Trifocale" },
  { value: "mista", label: "Mista — OD e OS indipendenti" },
];
const TIPI_LAC = ["monofocale", "multifocale", "rigida", "semirigida", "specialistica"] as const;

function n(valore: string): number | null {
  if (valore.trim() === "") return null;
  const numero = Number(valore.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function GruppoOcchio({
  lato,
  valore,
  imposta,
  conAdd = true,
}: {
  lato: "od" | "os";
  valore: Occhio;
  imposta: (prossimo: Occhio) => void;
  conAdd?: boolean;
}) {
  const nome = lato.toUpperCase();
  const aggiorna = (chiave: keyof Occhio, nuovo: string) => imposta({ ...valore, [chiave]: nuovo });
  return (
    <div className="grid grid-cols-[2.4rem_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-[2.4rem_repeat(5,minmax(0,1fr))]">
      <span className="f-mono self-center text-sm font-semibold text-inchiostro">{nome}</span>
      <input aria-label={`${nome} sfero`} name={`${lato}_sfero`} type="number" step="0.25" placeholder="sfero" className={`${inputCls} diottria`} value={valore.sfero} onChange={(e) => aggiorna("sfero", e.target.value)} />
      <input aria-label={`${nome} cilindro`} name={`${lato}_cilindro`} type="number" step="0.25" max={0} placeholder="cil." className={`${inputCls} diottria`} value={valore.cilindro} onChange={(e) => aggiorna("cilindro", e.target.value)} />
      <input aria-label={`${nome} asse`} name={`${lato}_asse`} type="number" min={0} max={180} step="1" placeholder="asse" className={`${inputCls} diottria`} value={valore.asse} onChange={(e) => aggiorna("asse", e.target.value)} />
      {conAdd && <input aria-label={`${nome} addizione`} name={`${lato}_add`} type="number" min={0} step="0.25" placeholder="ADD" className={`${inputCls} diottria`} value={valore.add} onChange={(e) => aggiorna("add", e.target.value)} />}
      <input aria-label={`${nome} visus corretto`} name={`${lato}_visus`} placeholder="visus" className={inputCls} value={valore.visus} onChange={(e) => aggiorna("visus", e.target.value)} />
    </div>
  );
}

function RigaLac({ lato }: { lato: "od" | "os" }) {
  const etichetta = lato.toUpperCase();
  return (
    <Card className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-inchiostro">
        <input name={`lac_${lato}_attiva`} type="checkbox" defaultChecked className="h-4 w-4 accent-[#A67C42]" />
        LAC definitiva {etichetta}
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipologia"><select name={`lac_${lato}_tipologia`} className={inputCls} defaultValue="monofocale">{TIPI_LAC.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></Field>
        <Field label="Geometria"><select name={`lac_${lato}_geometria`} className={inputCls} defaultValue="sferica"><option value="sferica">Sferica</option><option value="torica">Torica</option></select></Field>
        <Field label="Visus corretto"><input aria-label={`LAC ${etichetta} visus corretto`} name={`lac_${lato}_visus`} required className={inputCls} placeholder="10/10" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Sfero"><input name={`lac_${lato}_sfero`} type="number" step="0.25" className={inputCls} /></Field>
        <Field label="Cilindro"><input name={`lac_${lato}_cilindro`} type="number" step="0.25" className={inputCls} /></Field>
        <Field label="Asse"><input name={`lac_${lato}_asse`} type="number" min={0} max={180} className={inputCls} /></Field>
        <Field label="Addizione"><input name={`lac_${lato}_addizione`} type="number" min={0} step="0.25" className={inputCls} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="BC"><input name={`lac_${lato}_bc`} type="number" step="0.1" className={inputCls} /></Field>
        <Field label="DIA"><input name={`lac_${lato}_dia`} type="number" step="0.1" className={inputCls} /></Field>
        <Field label="Fornitore"><input name={`lac_${lato}_fornitore`} className={inputCls} /></Field>
        <Field label="Modello"><input name={`lac_${lato}_modello`} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-soft"><input name={`lac_${lato}_dominante`} type="checkbox" /> Occhio dominante</label>
      <Field label={`Note ${etichetta}`}><textarea name={`lac_${lato}_note`} rows={2} className={inputCls} /></Field>
    </Card>
  );
}

export default function PrescrizioneForm({
  clienteId,
  oculisti,
  precedenti,
}: {
  clienteId: string;
  oculisti: { id: string; nome: string; studio: string | null }[];
  precedenti: { id: string; data_visita: string; uso: string | null; ha_occhiali: boolean; ha_lac: boolean; plano: boolean }[];
}) {
  const azioneBound = salvaSchedaUnica.bind(null, clienteId);
  const [stato, azione, inCorso] = useActionState(azioneBound, null);
  const [haOcchiali, setHaOcchiali] = useState(true);
  const [haLac, setHaLac] = useState(false);
  const [plano, setPlano] = useState(false);
  const [origine, setOrigine] = useState("check_up");
  const [tipologia, setTipologia] = useState<Tipologia>("lontano");
  const [od, setOd] = useState<Occhio>(VUOTO);
  const [os, setOs] = useState<Occhio>(VUOTO);
  const oggi = new Date().toISOString().slice(0, 10);
  const [dataVisita, setDataVisita] = useState(oggi);
  const [validita, setValidita] = useState("12");
  const [dataScadenza, setDataScadenza] = useState(calcolaScadenzaProposta(oggi, 12));

  const derivata = useMemo(() => {
    const add = n(od.add);
    const lontano = n(od.sfero);
    if (tipologia === "intermedio") return calcolaIntermedio(lontano, add);
    if (tipologia === "office") return calcolaOffice(lontano, add);
    return null;
  }, [od.add, od.sfero, tipologia]);

  const aggiornaData = (data: string, mesi = validita) => {
    setDataVisita(data);
    setDataScadenza(calcolaScadenzaProposta(data, Number(mesi) || 12));
  };

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      <Card className="space-y-3 border-ottone/40 bg-ottone-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-ottone-scuro">Consenso dati sanitari per prescrizione</p>
        <label className="flex items-start gap-3 text-sm text-inchiostro">
          <input type="checkbox" name="consenso_sanitario" required className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
          <span>Il cliente ha firmato l&apos;informativa e <strong>acconsente al trattamento dei dati sanitari</strong> per questa prescrizione.</span>
        </label>
        <input type="hidden" name="modalita_consenso" value="digitale" />
      </Card>

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Scheda unica</p>
        <div className="flex flex-wrap gap-5 text-sm text-inchiostro">
          <label className="flex items-center gap-2"><input name="ha_occhiali" type="checkbox" checked={haOcchiali} onChange={(e) => setHaOcchiali(e.target.checked)} /> Sezione Occhiali</label>
          <label className="flex items-center gap-2"><input name="ha_lac" type="checkbox" checked={haLac} onChange={(e) => setHaLac(e.target.checked)} /> Sezione LAC</label>
          <label className="flex items-center gap-2"><input name="plano" type="checkbox" checked={plano} onChange={(e) => { setPlano(e.target.checked); if (e.target.checked) setHaOcchiali(true); }} /> Plano / nessuna correzione</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data visita"><input aria-label="Data visita" name="data_visita" type="date" value={dataVisita} onChange={(e) => aggiornaData(e.target.value)} className={inputCls} /></Field>
          <Field label="Validità (mesi)"><input aria-label="Validità (mesi)" name="validita_mesi" type="number" min={1} max={60} value={validita} onChange={(e) => { setValidita(e.target.value); setDataScadenza(calcolaScadenzaProposta(dataVisita, Number(e.target.value) || 12)); }} className={inputCls} /></Field>
          <Field label="Scadenza"><input aria-label="Scadenza" name="data_scadenza" type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Origine"><select name="origine" value={origine} onChange={(e) => setOrigine(e.target.value)} className={inputCls}><option value="check_up">Check-up</option><option value="lenti_cliente">Lenti del cliente</option><option value="ricetta_oculistica">Ricetta oculistica</option><option value="prescrizione_precedente">Prescrizione precedente</option></select></Field>
          {origine === "ricetta_oculistica" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Oculista già in registro"><select name="oculista_id" className={inputCls} defaultValue=""><option value="">Inserisci al volo…</option>{oculisti.map((oculista) => <option key={oculista.id} value={oculista.id}>{oculista.nome}{oculista.studio ? ` · ${oculista.studio}` : ""}</option>)}</select></Field><Field label="Oculista — inserisci al volo"><input name="oculista_nome" className={inputCls} placeholder="Dott./Dott.ssa" /></Field></div>}
        </div>
        {precedenti.length > 0 && <div className="grid gap-3 sm:grid-cols-2"><Field label="Rettifica di una prescrizione precedente"><select name="rettifica_di" className={inputCls} defaultValue=""><option value="">Nessuna rettifica</option>{precedenti.map((p) => <option key={p.id} value={p.id}>{p.data_visita} · {[p.ha_occhiali && "occhiali", p.ha_lac && "LAC", p.plano && "plano"].filter(Boolean).join(" + ")} {p.uso ? `· ${p.uso}` : ""}</option>)}</select></Field><Field label="Natura della rettifica"><select name="rettifica_natura" className={inputCls} defaultValue="clinica"><option value="clinica">Rettifica clinica — conserva l'originale</option><option value="digitazione">Errore di digitazione — sostituisce l'originale</option></select></Field></div>}
      </Card>

      {haOcchiali && <>
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipologia Occhiali"><select name="tipologia" value={tipologia} onChange={(e) => setTipologia(e.target.value as Tipologia)} className={inputCls}>{TIPI_OCCHIALI.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select></Field>
            <Field label="Notazione"><select name="notazione" className={inputCls} defaultValue="tabo"><option value="tabo">TABO</option><option value="internazionale">Internazionale</option></select></Field>
          </div>
          {tipologia === "mista" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Tipologia OD"><select name="tipologia_od" className={inputCls}>{TIPI_OCCHIALI.filter((x) => x.value !== "mista").map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Tipologia OS"><select name="tipologia_os" className={inputCls}>{TIPI_OCCHIALI.filter((x) => x.value !== "mista").map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field></div>}
          <div className="grid grid-cols-[2.4rem_repeat(3,minmax(0,1fr))] gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-faint sm:grid-cols-[2.4rem_repeat(5,minmax(0,1fr))]"><span /><span>Sfero</span><span>Cil.</span><span>Asse</span><span>ADD</span><span>Visus</span></div>
          <GruppoOcchio lato="od" valore={od} imposta={setOd} />
          <GruppoOcchio lato="os" valore={os} imposta={setOs} />
          <div className="flex flex-wrap gap-4 text-sm text-soft"><label><input name="od_invariato" type="checkbox" /> OD invariato</label><label><input name="os_invariato" type="checkbox" /> OS invariato</label><label><input name="appaiamento" type="checkbox" /> Appaiamento intenzionale</label></div>
          <div className="rounded-xl bg-inchiostro px-4 py-3"><p className="f-mono text-sm tabular-nums text-carta">OD {fmtRefrazione(n(od.sfero), n(od.cilindro), n(od.asse))} · OS {fmtRefrazione(n(os.sfero), n(os.cilindro), n(os.asse))}{derivata !== null && ` · derivata ${fmtDiottria(derivata)}`}</p></div>
          {Math.abs(n(od.sfero) ?? 0) > 4 && <p className="text-xs text-soft">OD LAC proposta dopo vertice: {fmtDiottria(compensaDistanzaVertice(n(od.sfero)))}</p>}
        </Card>

        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Prisma per occhio</p>
          {(["od", "os"] as const).map((lato) => <div key={lato} className="grid grid-cols-[2.4rem_1fr_1fr] gap-2"><span className="self-center f-mono font-semibold">{lato.toUpperCase()}</span><input aria-label={`Prisma ${lato.toUpperCase()}`} name={`${lato}_prisma`} type="number" min={0} step="0.25" className={inputCls} placeholder="valore" /><select aria-label={`Base prisma ${lato.toUpperCase()}`} name={`${lato}_prisma_base`} className={inputCls} defaultValue=""><option value="">Base —</option><option value="interna">Interna</option><option value="esterna">Esterna</option><option value="superiore">Superiore</option><option value="inferiore">Inferiore</option></select></div>)}
        </Card>

        <Card className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-faint">Prescrizioni speciali</p><div className="flex flex-wrap gap-4 text-sm">{["bangerter", "occlusione", "filtro_medicale", "tinta_terapeutica", "altro"].map((speciale) => <label key={speciale} className="flex gap-2"><input name="speciali" type="checkbox" value={speciale} /> {speciale.replace("_", " ")}</label>)}</div><Field label="Descrizione altro"><input name="speciali_note" className={inputCls} /></Field></Card>
      </>}

      {haLac && <Card className="space-y-4"><p className="text-xs font-semibold uppercase tracking-wide text-faint">LAC definitiva — ponte B4</p><p className="text-sm text-soft">Inserimento diretto della prescrizione definitiva. Prove, campioni e conferma da prova appartengono al filone Y/M5.</p><RigaLac lato="od" /><RigaLac lato="os" /></Card>}

      <Card><Field label="Note cliniche"><textarea name="note" rows={3} className={inputCls} placeholder="Osservazioni cliniche e istruzioni." /></Field></Card>
      <div className="flex flex-wrap justify-end gap-3"><button name="azione_post_salvataggio" value="chiudi" type="submit" disabled={inCorso} className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta disabled:opacity-50">{inCorso ? "Salvo…" : "Salva e chiudi"}</button><button name="azione_post_salvataggio" value="crea_ordine" type="submit" disabled={inCorso} className="rounded-xl border border-inchiostro px-5 py-2.5 text-sm font-semibold text-inchiostro disabled:opacity-50">Salva e crea ordine</button></div>
    </form>
  );
}
