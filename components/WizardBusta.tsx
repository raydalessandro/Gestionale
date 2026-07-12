"use client";

import { useActionState, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { creaBusta } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { PrescrizioneRow } from "@/lib/database.types";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import {
  Passi,
  SchedaClienteMini,
  SelettoreRx,
} from "@/components/WizardOrdineLac";
import { RxMono, DESCR_TIPO_LAVORO, ETICHETTE_TIPO_LAVORO } from "@/components/OrdiniUI";
import { fmtEuro } from "@/lib/utils";

type ClienteMini = {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
};

const TIPI_LAVORO = [
  "occhiale_completo",
  "solo_lenti",
  "solo_montatura",
  "montatura_cliente",
] as const;

const INDICI = ["1.50", "1.60", "1.67", "1.74"];
const TRATTAMENTI = [
  "antiriflesso",
  "indurente",
  "filtro luce blu",
  "fotocromatico",
  "idrorepellente",
];

function n(s: string): number {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function fuoriRange(s: string, min: number, max: number): boolean {
  if (s.trim() === "") return false;
  const v = Number(s.replace(",", "."));
  return !Number.isFinite(v) || v < min || v > max;
}

export default function WizardBusta({
  clientePreselezionato,
}: {
  clientePreselezionato: ClienteMini | null;
}) {
  const [stato, azione, inCorso] = useActionState(creaBusta, null);
  const supabase = createClient();

  const [passo, setPasso] = useState(clientePreselezionato ? 2 : 1);
  const [cliente, setCliente] = useState<ClienteMini | null>(clientePreselezionato);

  const [term, setTerm] = useState("");
  const [risultati, setRisultati] = useState<ClienteMini[]>([]);
  const [rxList, setRxList] = useState<PrescrizioneRow[]>([]);
  const [rxId, setRxId] = useState<string | null>(null);

  const [tipoLavoro, setTipoLavoro] =
    useState<(typeof TIPI_LAVORO)[number]>("occhiale_completo");

  const [pMont, setPMont] = useState("0");
  const [pLenti, setPLenti] = useState("0");
  const [pExtra, setPExtra] = useState("0");
  const [sconto, setSconto] = useState("0");

  const [odDnp, setOdDnp] = useState("");
  const [osDnp, setOsDnp] = useState("");
  const [odAlt, setOdAlt] = useState("");
  const [osAlt, setOsAlt] = useState("");

  const [acconto, setAcconto] = useState("");
  const [accontoManuale, setAccontoManuale] = useState(false);
  const [dataPromessa, setDataPromessa] = useState("");

  // Ricerca cliente
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
        .eq("tipo", "occhiali")
        .order("data_visita", { ascending: false });
      setRxList(data ?? []);
    })();
  }, [cliente, supabase]);

  // Default data promessa (+7 gg) impostato lato client per evitare mismatch.
  useEffect(() => {
    if (dataPromessa === "")
      setDataPromessa(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totale = Math.max(0, n(pMont) + n(pLenti) + n(pExtra) - n(sconto));
  const suggerito = Math.round((totale * 0.3) / 5) * 5;
  const saldo = totale - (n(acconto) || 0);

  // Acconto suggerito al 30% quando si arriva al riepilogo.
  useEffect(() => {
    if (passo === 6 && !accontoManuale) setAcconto(String(suggerito));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, suggerito]);

  const rxSelezionata = rxList.find((r) => r.id === rxId) ?? null;
  const montaturaFacolt = tipoLavoro === "solo_lenti" || tipoLavoro === "montatura_cliente";

  const centraturaErr =
    fuoriRange(odDnp, 20, 40) ||
    fuoriRange(osDnp, 20, 40) ||
    fuoriRange(odAlt, 10, 35) ||
    fuoriRange(osAlt, 10, 35);

  const step = (n: number) => (passo === n ? "space-y-4" : "hidden");

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
      <input type="hidden" name="prescrizione_id" value={rxId ?? ""} />

      <Passi
        passo={passo}
        etichette={["Cliente", "Montatura", "Lenti", "Extra", "Centratura", "Riepilogo"]}
      />

      {/* STEP 1 — Cliente & prescrizione */}
      <div className={step(1)}>
        {!cliente ? (
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
        ) : (
          <>
            <SchedaClienteMini
              cliente={cliente}
              onCambia={() => {
                setCliente(null);
                setRxId(null);
                setPasso(1);
              }}
            />
            <SelettoreRx rxList={rxList} rxId={rxId} onScegli={setRxId} tipo="occhiali" />
          </>
        )}
      </div>

      {/* STEP 2 — Tipo lavoro & montatura */}
      <div className={step(2)}>
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Tipo di lavoro
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TIPI_LAVORO.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors ${
                  tipoLavoro === t
                    ? "border-ottone bg-ottone-soft"
                    : "border-linea bg-white hover:border-faint"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tipo_lavoro"
                    value={t}
                    checked={tipoLavoro === t}
                    onChange={() => setTipoLavoro(t)}
                    className="h-4 w-4 accent-[#A67C42]"
                  />
                  <span className="text-sm font-semibold text-inchiostro">
                    {ETICHETTE_TIPO_LAVORO[t]}
                  </span>
                </span>
                <span className="pl-6 text-xs text-soft">{DESCR_TIPO_LAVORO[t]}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Montatura {montaturaFacolt && <span className="text-faint">· facoltativa</span>}
          </p>
          {tipoLavoro === "montatura_cliente" && (
            <p className="rounded-xl bg-carta px-3 py-2 text-xs text-soft">
              Il cliente porta la sua montatura: usa marca/modello come descrizione
              (es. &quot;Ray-Ban del cliente, nero&quot;).
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Marca">
              <input name="montatura_marca" className={inputCls} placeholder="Ray-Ban" />
            </Field>
            <Field label="Modello">
              <input name="montatura_modello" className={inputCls} placeholder="RB5154" />
            </Field>
            <Field label="Colore">
              <input name="montatura_colore" className={inputCls} placeholder="Havana" />
            </Field>
            <Field label="Calibro">
              <input
                name="montatura_calibro"
                className={`${inputCls} f-mono`}
                placeholder="52▢18 145"
              />
            </Field>
            <Field label="UPC / codice">
              <input name="montatura_upc" className={`${inputCls} f-mono`} placeholder="8053672…" />
            </Field>
            <Field label="Prezzo montatura (€)">
              <input
                name="prezzo_montatura"
                type="number"
                step="0.01"
                min={0}
                value={pMont}
                onChange={(e) => setPMont(e.target.value)}
                className={`${inputCls} diottria`}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* STEP 3 — Lenti & trattamenti */}
      <div className={step(3)}>
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Lenti e trattamenti
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo lente">
              <select name="lente_tipo" defaultValue="" className={inputCls}>
                <option value="">—</option>
                <option value="monofocale">Monofocale</option>
                <option value="progressiva">Progressiva</option>
                <option value="bifocale">Bifocale</option>
                <option value="office">Office</option>
              </select>
            </Field>
            <Field label="Materiale">
              <input name="lente_materiale" className={inputCls} placeholder="Organico, policarbonato…" />
            </Field>
            <Field label="Indice">
              <select name="lente_indice" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {INDICI.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prezzo lenti (€)">
              <input
                name="prezzo_lenti"
                type="number"
                step="0.01"
                min={0}
                value={pLenti}
                onChange={(e) => setPLenti(e.target.value)}
                className={`${inputCls} diottria`}
              />
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-soft">
              Trattamenti
            </p>
            <div className="flex flex-wrap gap-2">
              {TRATTAMENTI.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-linea bg-white px-3 py-2 text-sm text-inchiostro"
                >
                  <input
                    type="checkbox"
                    name="trattamenti"
                    value={t}
                    className="h-4 w-4 accent-[#A67C42]"
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* STEP 4 — Garanzia & extra */}
      <div className={step(4)}>
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Garanzia ed extra
          </p>
          <Field label="Garanzia">
            <input
              name="garanzia"
              className={inputCls}
              placeholder="Garanzia 24 mesi inclusa"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prezzo extra (€)" hint="Accessori, servizi aggiuntivi.">
              <input
                name="prezzo_extra"
                type="number"
                step="0.01"
                min={0}
                value={pExtra}
                onChange={(e) => setPExtra(e.target.value)}
                className={`${inputCls} diottria`}
              />
            </Field>
            <Field label="Sconto (€)">
              <input
                name="sconto"
                type="number"
                step="0.01"
                min={0}
                value={sconto}
                onChange={(e) => setSconto(e.target.value)}
                className={`${inputCls} diottria`}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* STEP 5 — Centratura */}
      <div className={step(5)}>
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Centratura {tipoLavoro === "solo_montatura" && <span className="text-faint">· facoltativa</span>}
          </p>
          <div className="grid grid-cols-[2.4rem_1fr_1fr] gap-2 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            <span />
            <span>DNP (20–40)</span>
            <span>Altezza (10–35)</span>
          </div>
          {(
            [
              ["OD", odDnp, setOdDnp, odAlt, setOdAlt],
              ["OS", osDnp, setOsDnp, osAlt, setOsAlt],
            ] as const
          ).map(([lato, dnp, setDnp, alt, setAlt]) => (
            <div key={lato} className="grid grid-cols-[2.4rem_1fr_1fr] items-center gap-2">
              <span className="f-mono text-sm font-semibold text-inchiostro">{lato}</span>
              <input
                name={lato === "OD" ? "od_dnp" : "os_dnp"}
                type="number"
                step="0.5"
                inputMode="decimal"
                value={dnp}
                onChange={(e) => setDnp(e.target.value)}
                className={`${inputCls} diottria ${
                  fuoriRange(dnp, 20, 40) ? "!border-rosso" : ""
                }`}
              />
              <input
                name={lato === "OD" ? "od_altezza" : "os_altezza"}
                type="number"
                step="0.5"
                inputMode="decimal"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                className={`${inputCls} diottria ${
                  fuoriRange(alt, 10, 35) ? "!border-rosso" : ""
                }`}
              />
            </div>
          ))}
          {centraturaErr && (
            <p className="text-xs text-rosso">
              Valori fuori range: DNP 20–40 mm, altezze 10–35 mm.
            </p>
          )}
        </Card>
      </div>

      {/* STEP 6 — Riepilogo */}
      <div className={step(6)}>
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Riepilogo
          </p>
          <div className="rounded-xl bg-carta px-4 py-3 text-sm">
            <p className="font-semibold text-inchiostro">
              {cliente ? `${cliente.cognome} ${cliente.nome}` : "—"}
            </p>
            {rxSelezionata ? (
              <RxMono p={rxSelezionata} className="mt-1 block" />
            ) : (
              <p className="mt-1 text-xs text-faint">Busta senza prescrizione collegata</p>
            )}
            <p className="mt-2 text-xs text-soft">
              {ETICHETTE_TIPO_LAVORO[tipoLavoro]}
            </p>
          </div>

          <div className="rounded-xl bg-inchiostro px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-carta/70">
                Totale
              </span>
              <span className="f-mono text-2xl font-semibold tabular-nums text-carta">
                {fmtEuro(totale)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Acconto (€)" hint="Suggerito 30%, modificabile.">
              <input
                name="acconto"
                type="number"
                step="0.01"
                min={0}
                max={totale}
                value={acconto}
                onChange={(e) => {
                  setAcconto(e.target.value);
                  setAccontoManuale(true);
                }}
                className={`${inputCls} diottria`}
              />
            </Field>
            <Field label="Da promettere per il">
              <input
                name="data_promessa"
                type="date"
                value={dataPromessa}
                onChange={(e) => setDataPromessa(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-linea px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-soft">
              Saldo alla consegna
            </span>
            <span className="f-mono text-lg font-semibold tabular-nums text-inchiostro">
              {fmtEuro(saldo)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Laboratorio" hint="Facoltativo.">
              <input name="laboratorio" className={inputCls} placeholder="Nome laboratorio" />
            </Field>
          </div>
          <Field label="Note">
            <textarea
              name="note"
              rows={2}
              className={inputCls}
              placeholder="Indicazioni per il laboratorio, preferenze…"
            />
          </Field>
        </Card>
      </div>

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

        {passo < 6 ? (
          <button
            type="button"
            onClick={() => setPasso((p) => Math.min(6, p + 1))}
            disabled={
              (passo === 1 && !cliente) || (passo === 5 && centraturaErr)
            }
            className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-40"
          >
            Avanti
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="submit"
              name="stato"
              value="preventivo"
              disabled={inCorso || !cliente || centraturaErr}
              className="rounded-xl border border-linea bg-white px-4 py-2.5 text-sm font-semibold text-inchiostro transition-colors hover:bg-carta disabled:opacity-50"
            >
              Salva come preventivo
            </button>
            <button
              type="submit"
              name="stato"
              value="lavorazione"
              disabled={inCorso || !cliente || centraturaErr}
              className="rounded-xl bg-ottone px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50"
            >
              {inCorso ? "Creo…" : "Crea busta"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
