"use client";

import { useActionState, useState } from "react";
import { chiudiCassa } from "@/lib/actions";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { fmtEuro, ETICHETTE_ALIQUOTA } from "@/lib/utils";

function nn(s: string): number {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function coloreDiff(d: number): string {
  const a = Math.abs(d);
  if (a < 0.005) return "text-verde";
  if (a <= 0.05) return "text-ambra";
  return "text-rosso";
}

export default function WizardChiusura({
  metodi,
  aliquote,
  caparre,
  fondoApertura,
  saldoCassaforte,
}: {
  metodi: { nome: string; sistema: number }[];
  aliquote: { aliquota: string; sistema: number }[];
  caparre: { emesse: number; scontate: number; incamerate: number };
  fondoApertura: number;
  saldoCassaforte: number;
}) {
  const [stato, run, inCorso] = useActionState(chiudiCassa, null);

  const [fondoAp, setFondoAp] = useState(String(fondoApertura));
  const [contanti, setContanti] = useState("");
  const [fondoCh, setFondoCh] = useState(String(fondoApertura));
  const [dich, setDich] = useState<Record<string, string>>({});
  const [caus, setCaus] = useState<Record<string, string>>({});
  const [stamp, setStamp] = useState<Record<string, string>>({});

  const isContanti = (n: string) => n.toLowerCase() === "contanti";
  const dichiaratoDi = (m: { nome: string }) => (isContanti(m.nome) ? nn(contanti) : nn(dich[m.nome] ?? ""));
  const diffDi = (m: { nome: string; sistema: number }) =>
    (isContanti(m.nome) ? nn(contanti) - nn(fondoAp) : nn(dich[m.nome] ?? "")) - m.sistema;

  const versamento = nn(contanti) - nn(fondoCh);

  const quadraturaJson = JSON.stringify(
    metodi.map((m) => ({ metodo: m.nome, dichiarato: dichiaratoDi(m), causale: caus[m.nome] ?? "" }))
  );
  const confrontoJson = JSON.stringify(
    aliquote.map((a) => ({ aliquota: a.aliquota, stampante: nn(stamp[a.aliquota] ?? "") }))
  );

  return (
    <form action={run} className="space-y-4">
      <Errore msg={stato?.errore} />
      <input type="hidden" name="quadratura" value={quadraturaJson} />
      <input type="hidden" name="confronto" value={confrontoJson} />
      <input type="hidden" name="fondo_apertura" value={fondoAp} />
      <input type="hidden" name="contanti_contati" value={contanti} />
      <input type="hidden" name="fondo_chiusura" value={fondoCh} />

      {/* 1 · Conta per metodo */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">1 · Conta per metodo</p>
        {metodi.map((m) => {
          const d = diffDi(m);
          return (
            <div key={m.nome} className="grid grid-cols-[1fr_5rem_5rem_1fr] items-center gap-2 text-sm">
              <span className="text-inchiostro">{m.nome}{isContanti(m.nome) && <span className="text-[10px] text-faint"> (fondo incl.)</span>}</span>
              <span className="f-mono text-right tabular-nums text-faint">{fmtEuro(m.sistema)}</span>
              {isContanti(m.nome) ? (
                <input value={contanti} onChange={(e) => setContanti(e.target.value)} type="number" step="0.01" placeholder="contati" className={`${inputCls} diottria !py-1`} aria-label={`dichiarato ${m.nome}`} />
              ) : (
                <input value={dich[m.nome] ?? ""} onChange={(e) => setDich((s) => ({ ...s, [m.nome]: e.target.value }))} type="number" step="0.01" placeholder="dich." className={`${inputCls} diottria !py-1`} aria-label={`dichiarato ${m.nome}`} />
              )}
              <div className="flex items-center gap-1">
                <span className={`f-mono text-xs tabular-nums ${coloreDiff(d)}`}>{d >= 0 ? "+" : ""}{d.toFixed(2)}</span>
                {Math.abs(d) > 0.05 && (
                  <input value={caus[m.nome] ?? ""} onChange={(e) => setCaus((s) => ({ ...s, [m.nome]: e.target.value }))} placeholder="causale" className={`${inputCls} !py-1 !px-2 text-xs`} aria-label={`causale ${m.nome}`} />
                )}
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[1fr_5rem_5rem_1fr] text-[10px] uppercase tracking-wide text-faint">
          <span></span><span className="text-right">sistema</span><span>dichiar.</span><span>differenza</span>
        </div>
      </Card>

      {/* 2 · Confronto col registratore */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">2 · Confronto col registratore (Z)</p>
        <Field label="N° azzeramento Z"><input name="z_numero" className={`${inputCls} f-mono`} placeholder="dal Z report" /></Field>
        {aliquote.map((a) => {
          const d = nn(stamp[a.aliquota] ?? "") - a.sistema;
          return (
            <div key={a.aliquota} className="grid grid-cols-[1fr_5rem_5rem_4rem] items-center gap-2 text-sm">
              <span className="text-inchiostro">{ETICHETTE_ALIQUOTA[a.aliquota] ?? a.aliquota}</span>
              <span className="f-mono text-right tabular-nums text-faint">{fmtEuro(a.sistema)}</span>
              <input value={stamp[a.aliquota] ?? ""} onChange={(e) => setStamp((s) => ({ ...s, [a.aliquota]: e.target.value }))} type="number" step="0.01" placeholder="stampante" className={`${inputCls} diottria !py-1`} aria-label={`stampante ${a.aliquota}`} />
              <span className={`f-mono text-right text-xs tabular-nums ${coloreDiff(d)}`}>{d >= 0 ? "+" : ""}{d.toFixed(2)}</span>
            </div>
          );
        })}
        <p className="text-[11px] text-faint">Dal Z report, sezione IVA–Nature.</p>
      </Card>

      {/* 3 · Cassaforte */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">3 · Cassaforte</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Fondo apertura"><input value={fondoAp} onChange={(e) => setFondoAp(e.target.value)} type="number" step="0.01" className={`${inputCls} diottria`} /></Field>
          <Field label="Contanti contati"><input value={contanti} onChange={(e) => setContanti(e.target.value)} type="number" step="0.01" className={`${inputCls} diottria`} /></Field>
          <Field label="Fondo che resta"><input value={fondoCh} onChange={(e) => setFondoCh(e.target.value)} type="number" step="0.01" className={`${inputCls} diottria`} /></Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-soft">Versamento: <span className="f-mono font-semibold text-inchiostro">{fmtEuro(versamento)}</span></span>
          <span className="text-soft">Saldo cassaforte dopo: <span className="f-mono font-semibold text-inchiostro">{fmtEuro(saldoCassaforte + versamento)}</span></span>
        </div>
      </Card>

      {/* 4 · Caparre e note */}
      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">4 · Caparre del giorno</p>
        <p className="text-sm text-soft">emesse {fmtEuro(caparre.emesse)} · scalate {fmtEuro(caparre.scontate)} · incamerate {fmtEuro(caparre.incamerate)}</p>
        <Field label="Note"><textarea name="note" rows={2} className={inputCls} /></Field>
      </Card>

      <div className="flex justify-end">
        <button type="submit" disabled={inCorso} className="rounded-xl bg-ottone px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50">
          {inCorso ? "Chiudo…" : "Chiudi la giornata"}
        </button>
      </div>
    </form>
  );
}
