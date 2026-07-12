"use client";

import { useActionState, useEffect, useState } from "react";
import { Search, Trash2, Plus, Wand2 } from "lucide-react";
import { creaOrdineLac } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { PrescrizioneRow } from "@/lib/database.types";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { RxMono } from "@/components/OrdiniUI";
import { fmtEuro, fmtData, rxValida } from "@/lib/utils";

type ClienteMini = {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
};

type RigaState = {
  descrizione: string;
  occhio: "" | "OD" | "OS";
  sfero: string;
  cilindro: string;
  asse: string;
  raggio: string;
  diametro: string;
  addizione: string;
  quantita: string;
  prezzo: string;
};

const rigaVuota: RigaState = {
  descrizione: "",
  occhio: "",
  sfero: "",
  cilindro: "",
  asse: "",
  raggio: "",
  diametro: "",
  addizione: "",
  quantita: "1",
  prezzo: "0",
};

function n(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export default function WizardOrdineLac({
  clientePreselezionato,
}: {
  clientePreselezionato: ClienteMini | null;
}) {
  const [stato, azione, inCorso] = useActionState(creaOrdineLac, null);
  const supabase = createClient();

  const [passo, setPasso] = useState(clientePreselezionato ? 2 : 1);
  const [cliente, setCliente] = useState<ClienteMini | null>(clientePreselezionato);

  // Ricerca cliente
  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);

  // Prescrizioni LAC del cliente
  const [rxList, setRxList] = useState<PrescrizioneRow[]>([]);
  const [rxId, setRxId] = useState<string | null>(null);

  const [righe, setRighe] = useState<RigaState[]>([{ ...rigaVuota }]);

  useEffect(() => {
    if (cliente || term.trim().length < 2) {
      setRisultati([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = term.trim().replace(/[%,]/g, "");
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, telefono")
        .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%`)
        .limit(8);
      setRisultati(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [term, cliente, supabase]);

  useEffect(() => {
    if (!cliente) return;
    (async () => {
      const { data } = await supabase
        .from("prescrizioni")
        .select("*")
        .eq("cliente_id", cliente.id)
        .eq("tipo", "lac")
        .order("data_visita", { ascending: false });
      setRxList(data ?? []);
    })();
  }, [cliente, supabase]);

  const rxSelezionata = rxList.find((r) => r.id === rxId) ?? null;

  function daPrescrizione() {
    if (!rxSelezionata) return;
    const p = rxSelezionata;
    const perOcchio = (lato: "od" | "os", occhio: "OD" | "OS"): RigaState => ({
      ...rigaVuota,
      descrizione: `Lente ${occhio}`,
      occhio,
      sfero: p[`${lato}_sfero`] != null ? String(p[`${lato}_sfero`]) : "",
      cilindro: p[`${lato}_cilindro`] != null ? String(p[`${lato}_cilindro`]) : "",
      asse: p[`${lato}_asse`] != null ? String(p[`${lato}_asse`]) : "",
      raggio: p[`${lato}_raggio`] != null ? String(p[`${lato}_raggio`]) : "",
      diametro: p[`${lato}_diametro`] != null ? String(p[`${lato}_diametro`]) : "",
      addizione: p.addizione != null ? String(p.addizione) : "",
    });
    setRighe([perOcchio("od", "OD"), perOcchio("os", "OS")]);
  }

  const totale = righe.reduce(
    (s, r) => s + (n(r.quantita) ?? 0) * (n(r.prezzo) ?? 0),
    0
  );

  const righeJson = JSON.stringify(
    righe.map((r) => ({
      descrizione: r.descrizione,
      occhio: r.occhio || null,
      parametri: {
        sfero: n(r.sfero),
        cilindro: n(r.cilindro),
        asse: n(r.asse),
        raggio: n(r.raggio),
        diametro: n(r.diametro),
        addizione: n(r.addizione),
      },
      quantita: n(r.quantita) ?? 1,
      prezzo: n(r.prezzo) ?? 0,
    }))
  );

  const righeValide = righe.length > 0 && righe.every((r) => r.descrizione.trim() !== "");

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      {/* Campi nascosti per la server action */}
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
      <input type="hidden" name="prescrizione_id" value={rxId ?? ""} />
      <input type="hidden" name="righe" value={righeJson} />

      <Passi passo={passo} etichette={["Cliente", "Righe", "Riepilogo"]} />

      {/* STEP 1 — Cliente & prescrizione */}
      {passo === 1 && (
        <Card className="space-y-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cerca cliente per nome o cognome…"
              className={`${inputCls} !pl-10`}
            />
          </div>
          {risultati.length > 0 && (
            <div className="divide-y divide-linea rounded-xl border border-linea">
              {risultati.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCliente(c);
                    setRisultati([]);
                    setTerm("");
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-carta"
                >
                  <span className="font-semibold text-inchiostro">
                    {c.cognome} {c.nome}
                  </span>
                  <span className="text-xs text-faint">{c.telefono ?? ""}</span>
                </button>
              ))}
            </div>
          )}
          {term.trim().length >= 2 && risultati.length === 0 && (
            <p className="text-sm text-faint">Nessun cliente trovato.</p>
          )}
        </Card>
      )}

      {passo === 2 && cliente && (
        <>
          <SchedaClienteMini
            cliente={cliente}
            onCambia={() => {
              setCliente(null);
              setRxId(null);
              setPasso(1);
            }}
          />
          <SelettoreRx
            rxList={rxList}
            rxId={rxId}
            onScegli={setRxId}
            tipo="lac"
          />
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Righe ordine
              </p>
              <div className="flex gap-1.5">
                {rxSelezionata && (
                  <button
                    type="button"
                    onClick={daPrescrizione}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ottone bg-ottone-soft px-3 py-1 text-xs font-semibold text-ottone-scuro"
                  >
                    <Wand2 size={13} /> Da prescrizione
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRighe((r) => [...r, { ...rigaVuota }])}
                  className="inline-flex items-center gap-1.5 rounded-full border border-linea bg-white px-3 py-1 text-xs font-medium text-soft hover:border-faint hover:text-inchiostro"
                >
                  <Plus size={13} /> Aggiungi riga
                </button>
              </div>
            </div>

            {righe.map((r, i) => (
              <RigaEditor
                key={i}
                riga={r}
                onChange={(nuova) =>
                  setRighe((rr) => rr.map((x, j) => (j === i ? nuova : x)))
                }
                onRimuovi={
                  righe.length > 1
                    ? () => setRighe((rr) => rr.filter((_, j) => j !== i))
                    : undefined
                }
              />
            ))}

            <div className="flex items-center justify-between rounded-xl bg-inchiostro px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-carta/70">
                Totale
              </span>
              <span className="f-mono text-lg font-semibold tabular-nums text-carta">
                {fmtEuro(totale)}
              </span>
            </div>
          </Card>
        </>
      )}

      {/* STEP 3 — Riepilogo */}
      {passo === 3 && cliente && (
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Riepilogo
          </p>
          <div className="rounded-xl bg-carta px-4 py-3 text-sm">
            <p className="font-semibold text-inchiostro">
              {cliente.cognome} {cliente.nome}
            </p>
            {rxSelezionata ? (
              <RxMono p={rxSelezionata} className="mt-1 block" />
            ) : (
              <p className="mt-1 text-xs text-faint">
                Ordine senza prescrizione collegata
              </p>
            )}
            <p className="mt-2 f-mono text-sm tabular-nums text-inchiostro">
              {righe.length} righe · totale {fmtEuro(totale)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Arrivo previsto" hint="Facoltativo.">
              <input name="data_arrivo_prevista" type="date" className={inputCls} />
            </Field>
            <Field label="Acconto (€)" hint="Facoltativo — informativo in questa fase.">
              <input
                name="acconto"
                type="number"
                step="0.01"
                min={0}
                defaultValue="0"
                className={`${inputCls} diottria`}
              />
            </Field>
          </div>
          <Field label="Note">
            <textarea
              name="note"
              rows={2}
              className={inputCls}
              placeholder="Indicazioni, fornitore, riferimenti…"
            />
          </Field>
        </Card>
      )}

      {/* Navigazione */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(1, p - 1))}
          disabled={passo === 1}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-soft transition-colors hover:text-inchiostro disabled:opacity-40"
        >
          Indietro
        </button>

        {passo < 3 ? (
          <button
            type="button"
            onClick={() => setPasso((p) => p + 1)}
            disabled={(passo === 1 && !cliente) || (passo === 2 && !righeValide)}
            className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-40"
          >
            Avanti
          </button>
        ) : (
          <button
            type="submit"
            disabled={inCorso || !righeValide}
            className="rounded-xl bg-ottone px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50"
          >
            {inCorso ? "Creo…" : "Crea ordine"}
          </button>
        )}
      </div>
    </form>
  );
}

/* ── Sotto-componenti condivisi ────────────────────────────────────── */

export function Passi({
  passo,
  etichette,
}: {
  passo: number;
  etichette: string[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {etichette.map((e, i) => {
        const num = i + 1;
        const attivo = num === passo;
        const fatto = num < passo;
        return (
          <div key={e} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                attivo
                  ? "bg-inchiostro text-carta"
                  : fatto
                    ? "bg-ottone text-white"
                    : "bg-carta text-faint"
              }`}
            >
              {num}
            </div>
            <span
              className={`hidden text-xs font-medium sm:inline ${
                attivo ? "text-inchiostro" : "text-faint"
              }`}
            >
              {e}
            </span>
            {i < etichette.length - 1 && (
              <div className="h-px flex-1 bg-linea" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SchedaClienteMini({
  cliente,
  onCambia,
}: {
  cliente: { nome: string; cognome: string; telefono: string | null };
  onCambia: () => void;
}) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-inchiostro">
          {cliente.cognome} {cliente.nome}
        </p>
        {cliente.telefono && (
          <p className="text-xs text-soft">{cliente.telefono}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onCambia}
        className="text-xs font-semibold text-ottone-scuro hover:underline"
      >
        Cambia
      </button>
    </Card>
  );
}

export function SelettoreRx({
  rxList,
  rxId,
  onScegli,
  tipo,
}: {
  rxList: PrescrizioneRow[];
  rxId: string | null;
  onScegli: (id: string | null) => void;
  tipo: "lac" | "occhiali";
}) {
  if (rxList.length === 0) {
    return (
      <Card>
        <p className="text-sm text-faint">
          Nessuna prescrizione {tipo === "lac" ? "LAC" : "occhiali"} per questo
          cliente: si può procedere senza.
        </p>
      </Card>
    );
  }
  return (
    <Card className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        Prescrizione collegata
      </p>
      <div className="space-y-2">
        {rxList.map((p) => {
          const valida = rxValida(p);
          const sel = rxId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (valida || sel) return onScegli(sel ? null : p.id);
                if (
                  confirm(
                    "Questa prescrizione è scaduta o non attiva. Collegarla comunque?"
                  )
                )
                  onScegli(p.id);
              }}
              className={`block w-full rounded-xl border px-4 py-2.5 text-left transition-colors ${
                sel
                  ? "border-ottone bg-ottone-soft"
                  : "border-linea bg-white hover:border-faint"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <RxMono p={p} />
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase ${
                    valida ? "text-verde" : "text-faint"
                  }`}
                >
                  {valida ? "valida" : "scaduta"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-faint">
                {fmtData(p.data_visita)}
              </p>
            </button>
          );
        })}
        {rxId && (
          <button
            type="button"
            onClick={() => onScegli(null)}
            className="text-xs font-medium text-soft hover:text-inchiostro"
          >
            Nessuna prescrizione collegata
          </button>
        )}
      </div>
    </Card>
  );
}

function RigaEditor({
  riga,
  onChange,
  onRimuovi,
}: {
  riga: RigaState;
  onChange: (r: RigaState) => void;
  onRimuovi?: () => void;
}) {
  const set = (patch: Partial<RigaState>) => onChange({ ...riga, ...patch });
  const [espanso, setEspanso] = useState(false);

  return (
    <div className="rounded-xl border border-linea p-3">
      <div className="flex items-start gap-2">
        <input
          value={riga.descrizione}
          onChange={(e) => set({ descrizione: e.target.value })}
          placeholder="Descrizione (obbligatoria)"
          className={`${inputCls} flex-1`}
        />
        {onRimuovi && (
          <button
            type="button"
            onClick={onRimuovi}
            className="mt-1 shrink-0 text-faint transition-colors hover:text-rosso"
            aria-label="Rimuovi riga"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_4.5rem_1fr] gap-2">
        <select
          value={riga.occhio}
          onChange={(e) => set({ occhio: e.target.value as RigaState["occhio"] })}
          className={inputCls}
        >
          <option value="">Occhio —</option>
          <option value="OD">OD</option>
          <option value="OS">OS</option>
        </select>
        <input
          type="number"
          min={1}
          step={1}
          value={riga.quantita}
          onChange={(e) => set({ quantita: e.target.value })}
          placeholder="q.tà"
          className={`${inputCls} diottria`}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={riga.prezzo}
          onChange={(e) => set({ prezzo: e.target.value })}
          placeholder="prezzo €"
          className={`${inputCls} diottria`}
        />
      </div>
      <button
        type="button"
        onClick={() => setEspanso((v) => !v)}
        className="mt-2 text-xs font-medium text-soft hover:text-inchiostro"
      >
        {espanso ? "− Parametri lente" : "+ Parametri lente"}
      </button>
      {espanso && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              ["sfero", "sf"],
              ["cilindro", "cil"],
              ["asse", "asse"],
              ["raggio", "BC"],
              ["diametro", "DIA"],
              ["addizione", "ADD"],
            ] as const
          ).map(([campo, ph]) => (
            <input
              key={campo}
              type="number"
              step="0.25"
              inputMode="decimal"
              value={riga[campo]}
              onChange={(e) => set({ [campo]: e.target.value } as Partial<RigaState>)}
              placeholder={ph}
              className={`${inputCls} diottria`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
