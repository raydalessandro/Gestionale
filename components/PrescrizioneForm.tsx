"use client";

import { useActionState, useState } from "react";
import { creaPrescrizione } from "@/lib/actions";
import { fmtRefrazione, fmtDiottria } from "@/lib/utils";
import { Card, Field, inputCls, Errore } from "@/components/ui";

/** Valori refrattivi come stringhe (input controllati, vuoto = null). */
interface Occhio {
  sfero: string;
  cilindro: string;
  asse: string;
}

const vuoto: Occhio = { sfero: "", cilindro: "", asse: "" };

/** Template rapidi — ripresi 1:1 dal modulo legacy VisitePrescrizioni. */
const TEMPLATE: { nome: string; od: Occhio; os: Occhio; add?: string }[] = [
  { nome: "Emmetrope", od: { sfero: "0", cilindro: "", asse: "" }, os: { sfero: "0", cilindro: "", asse: "" } },
  { nome: "Miopia lieve", od: { sfero: "-2.00", cilindro: "", asse: "" }, os: { sfero: "-2.00", cilindro: "", asse: "" } },
  { nome: "Miopia moderata", od: { sfero: "-4.00", cilindro: "-0.50", asse: "180" }, os: { sfero: "-4.00", cilindro: "-0.50", asse: "180" } },
  { nome: "Ipermetropia", od: { sfero: "+2.00", cilindro: "", asse: "" }, os: { sfero: "+2.00", cilindro: "", asse: "" } },
  { nome: "Astigmatismo", od: { sfero: "-1.00", cilindro: "-1.50", asse: "90" }, os: { sfero: "-1.00", cilindro: "-1.50", asse: "90" } },
];

function n(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export default function PrescrizioneForm({ clienteId }: { clienteId: string }) {
  const azioneBound = creaPrescrizione.bind(null, clienteId);
  const [stato, azione, inCorso] = useActionState(azioneBound, null);

  const [tipo, setTipo] = useState<"occhiali" | "lac">("occhiali");
  const [origine, setOrigine] = useState<"interna" | "esterna">("interna");
  const [od, setOd] = useState<Occhio>(vuoto);
  const [os, setOs] = useState<Occhio>(vuoto);
  const [add, setAdd] = useState("");

  const oggi = new Date().toISOString().slice(0, 10);

  function applicaTemplate(t: (typeof TEMPLATE)[number]) {
    setOd(t.od);
    setOs(t.os);
    if (t.add !== undefined) setAdd(t.add);
  }

  const anteprima = [
    `OD ${fmtRefrazione(n(od.sfero), n(od.cilindro), n(od.asse))}`,
    `OS ${fmtRefrazione(n(os.sfero), n(os.cilindro), n(os.asse))}`,
    n(add) !== null ? `ADD ${fmtDiottria(n(add))}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");

  const grigliaOcchio = (
    lato: "od" | "os",
    valori: Occhio,
    set: (o: Occhio) => void
  ) => (
    <div className="grid grid-cols-[2.4rem_1fr_1fr_1fr] items-center gap-2">
      <span className="f-mono text-sm font-semibold text-inchiostro">
        {lato.toUpperCase()}
      </span>
      <input
        name={`${lato}_sfero`}
        type="number"
        step="0.25"
        inputMode="decimal"
        placeholder="sf"
        className={`${inputCls} diottria`}
        value={valori.sfero}
        onChange={(e) => set({ ...valori, sfero: e.target.value })}
      />
      <input
        name={`${lato}_cilindro`}
        type="number"
        step="0.25"
        max={0}
        inputMode="decimal"
        placeholder="cil"
        className={`${inputCls} diottria`}
        value={valori.cilindro}
        onChange={(e) => set({ ...valori, cilindro: e.target.value })}
      />
      <input
        name={`${lato}_asse`}
        type="number"
        step="1"
        min={0}
        max={180}
        inputMode="numeric"
        placeholder="asse"
        className={`${inputCls} diottria`}
        value={valori.asse}
        onChange={(e) => set({ ...valori, asse: e.target.value })}
      />
    </div>
  );

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      {/* Tipo + dati visita */}
      <Card className="space-y-4">
        <input type="hidden" name="tipo" value={tipo} />
        <div className="flex rounded-xl border border-linea bg-carta p-1">
          {(["occhiali", "lac"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tipo === t
                  ? "bg-inchiostro text-carta"
                  : "text-soft hover:text-inchiostro"
              }`}
            >
              {t === "occhiali" ? "Occhiali" : "Lenti a contatto"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data visita">
            <input
              name="data_visita"
              type="date"
              defaultValue={oggi}
              className={inputCls}
            />
          </Field>
          <Field label="Origine">
            <select
              name="origine"
              className={inputCls}
              value={origine}
              onChange={(e) => setOrigine(e.target.value as "interna" | "esterna")}
            >
              <option value="interna">Rilevata in negozio</option>
              <option value="esterna">Ricetta esterna (oculista)</option>
            </select>
          </Field>
          {origine === "esterna" ? (
            <Field label="Esaminatore">
              <input
                name="esaminatore"
                className={inputCls}
                placeholder="Dr. Rossi"
              />
            </Field>
          ) : (
            <Field label="Uso">
              <select name="uso" className={inputCls} defaultValue="">
                <option value="">—</option>
                <option value="lontano">Lontano</option>
                <option value="vicino">Vicino</option>
                <option value="progressivo">Progressivo</option>
                <option value="bifocale">Bifocale</option>
                <option value="office">Office</option>
              </select>
            </Field>
          )}
        </div>
        {origine === "esterna" && (
          <Field label="Uso" className="sm:max-w-[calc(33%-0.7rem)]">
            <select name="uso" className={inputCls} defaultValue="">
              <option value="">—</option>
              <option value="lontano">Lontano</option>
              <option value="vicino">Vicino</option>
              <option value="progressivo">Progressivo</option>
              <option value="bifocale">Bifocale</option>
              <option value="office">Office</option>
            </select>
          </Field>
        )}
      </Card>

      {/* Refrazione */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Refrazione
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE.map((t) => (
              <button
                key={t.nome}
                type="button"
                onClick={() => applicaTemplate(t)}
                className="rounded-full border border-linea bg-carta px-3 py-1 text-xs font-medium text-soft transition-colors hover:border-ottone hover:text-ottone-scuro"
              >
                {t.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[2.4rem_1fr_1fr_1fr] gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
          <span />
          <span>Sfero</span>
          <span>Cilindro</span>
          <span>Asse</span>
        </div>
        {grigliaOcchio("od", od, setOd)}
        {grigliaOcchio("os", os, setOs)}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Addizione" hint="Progressive, bifocali, LAC multifocali.">
            <input
              name="addizione"
              type="number"
              step="0.25"
              min={0}
              inputMode="decimal"
              placeholder="+0.00"
              className={`${inputCls} diottria`}
              value={add}
              onChange={(e) => setAdd(e.target.value)}
            />
          </Field>
          <Field label="Validità (mesi)">
            <input
              name="validita_mesi"
              type="number"
              min={1}
              max={60}
              defaultValue={12}
              className={`${inputCls} diottria`}
            />
          </Field>
        </div>

        {/* Anteprima "da banco" */}
        <div className="rounded-xl bg-inchiostro px-4 py-3">
          <p className="f-mono text-sm tabular-nums text-carta">{anteprima}</p>
        </div>
      </Card>

      {/* Prisma (solo occhiali) */}
      {tipo === "occhiali" && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-semibold text-soft transition-colors hover:text-inchiostro">
            + Prisma (se serve)
          </summary>
          <Card className="mt-3 space-y-3">
            {(["od", "os"] as const).map((lato) => (
              <div
                key={lato}
                className="grid grid-cols-[2.4rem_1fr_1fr] items-center gap-2"
              >
                <span className="f-mono text-sm font-semibold text-inchiostro">
                  {lato.toUpperCase()}
                </span>
                <input
                  name={`${lato}_prisma`}
                  type="number"
                  step="0.25"
                  min={0}
                  inputMode="decimal"
                  placeholder="Δ diottrie"
                  className={`${inputCls} diottria`}
                />
                <select
                  name={`${lato}_prisma_base`}
                  className={inputCls}
                  defaultValue=""
                >
                  <option value="">base —</option>
                  <option value="alto">Base alto</option>
                  <option value="basso">Base basso</option>
                  <option value="nasale">Base nasale</option>
                  <option value="temporale">Base temporale</option>
                </select>
              </div>
            ))}
          </Card>
        </details>
      )}

      {/* Geometria LAC */}
      {tipo === "lac" && (
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Geometria lente · default 8.6 / 14.2
          </p>
          <div className="grid grid-cols-[2.4rem_1fr_1fr] gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            <span />
            <span>Raggio (BC)</span>
            <span>Diametro (DIA)</span>
          </div>
          {(["od", "os"] as const).map((lato) => (
            <div
              key={lato}
              className="grid grid-cols-[2.4rem_1fr_1fr] items-center gap-2"
            >
              <span className="f-mono text-sm font-semibold text-inchiostro">
                {lato.toUpperCase()}
              </span>
              <input
                name={`${lato}_raggio`}
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue="8.6"
                className={`${inputCls} diottria`}
              />
              <input
                name={`${lato}_diametro`}
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue="14.2"
                className={`${inputCls} diottria`}
              />
            </div>
          ))}
        </Card>
      )}

      <Card>
        <Field label="Note">
          <textarea
            name="note"
            rows={2}
            className={inputCls}
            placeholder="Osservazioni, tolleranze, indicazioni per il laboratorio…"
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50"
        >
          {inCorso ? "Salvo…" : "Salva prescrizione"}
        </button>
      </div>
    </form>
  );
}
