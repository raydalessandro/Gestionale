"use client";

import { useActionState } from "react";
import { creaCliente, aggiornaCliente } from "@/lib/actions";
import type { ClienteRow, AssicurazioneRow } from "@/lib/database.types";
import { FONTI_MANUALI } from "@/lib/database.types";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { ETICHETTE_CANALE_PREFERITO, ETICHETTE_FONTE } from "@/lib/utils";

/** Il blocco P.IVA vive in `clienti.dati_fatturazione` (jsonb), non in colonne. */
type DatiFatturazione = {
  ragione_sociale?: string | null;
  cf_piva?: string | null;
  codice_sdi?: string | null;
};

export default function ClienteForm({
  cliente,
  assicurazioni = [],
}: {
  cliente?: ClienteRow;
  assicurazioni?: AssicurazioneRow[];
}) {
  const azioneBound = cliente
    ? aggiornaCliente.bind(null, cliente.id)
    : creaCliente;
  const [stato, azione, inCorso] = useActionState(azioneBound, null);
  const fatt = (cliente?.dati_fatturazione ?? {}) as DatiFatturazione;

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      {/* 1 · Identità */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Identità
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <input name="nome" required className={inputCls} defaultValue={cliente?.nome ?? ""} placeholder="Laura" />
          </Field>
          <Field label="Secondo nome">
            <input name="secondo_nome" className={inputCls} defaultValue={cliente?.secondo_nome ?? ""} placeholder="Maria" />
          </Field>
          <Field label="Cognome *">
            <input name="cognome" required className={inputCls} defaultValue={cliente?.cognome ?? ""} placeholder="Bianchi" />
          </Field>
          <Field label="Data di nascita">
            <input name="data_nascita" type="date" className={inputCls} defaultValue={cliente?.data_nascita ?? ""} />
          </Field>
          <Field label="Sesso">
            <select name="sesso" className={inputCls} defaultValue={cliente?.sesso ?? ""} aria-label="sesso">
              <option value="">—</option>
              <option value="F">Femmina</option>
              <option value="M">Maschio</option>
            </select>
          </Field>
          <Field label="Codice fiscale" hint="Servirà per Tessera Sanitaria e fatturazione.">
            <input name="codice_fiscale" className={`${inputCls} f-mono uppercase`} maxLength={16} defaultValue={cliente?.codice_fiscale ?? ""} placeholder="BNCLRA85M50F205Z" />
          </Field>
          <Field label="Tutore legale" hint="Se il cliente è minorenne." className="sm:col-span-2">
            <input name="tutore_legale" className={inputCls} defaultValue={cliente?.tutore_legale ?? ""} placeholder="Nome e cognome del genitore / tutore" />
          </Field>
        </div>
      </Card>

      {/* 2 · Recapiti */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Recapiti
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cellulare">
            <input name="telefono" type="tel" className={inputCls} defaultValue={cliente?.telefono ?? ""} placeholder="+39 333 1234567" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputCls} defaultValue={cliente?.email ?? ""} placeholder="laura@esempio.it" />
          </Field>
          <Field label="Tel. casa">
            <input name="telefono_casa" type="tel" className={inputCls} defaultValue={cliente?.telefono_casa ?? ""} placeholder="02 1234567" />
          </Field>
          <Field label="Tel. lavoro">
            <input name="telefono_lavoro" type="tel" className={inputCls} defaultValue={cliente?.telefono_lavoro ?? ""} placeholder="02 7654321" />
          </Field>
          <Field label="Canale preferito" hint="Precompila la telefonata dei richiami.">
            <select name="canale_preferito" className={inputCls} defaultValue={cliente?.canale_preferito ?? ""} aria-label="canale preferito">
              <option value="">—</option>
              {Object.entries(ETICHETTE_CANALE_PREFERITO).map(([id, l]) => (
                <option key={id} value={id}>{l}</option>
              ))}
            </select>
          </Field>
          <label className="flex items-start gap-3 self-end rounded-xl border border-linea bg-carta px-3.5 py-3">
            <input
              type="checkbox"
              name="non_contattare"
              defaultChecked={cliente?.non_contattare ?? false}
              className="mt-0.5 h-4 w-4 accent-[#A67C42]"
            />
            <span className="text-sm text-inchiostro">
              Non contattare per promozioni
              <span className="block text-xs text-faint">
                Toglie il cliente dalle proposte commerciali; la sua merce lo raggiunge lo stesso.
              </span>
            </span>
          </label>
        </div>
      </Card>

      {/* 3 · Indirizzo */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Indirizzo
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Via" className="sm:col-span-2">
            <input name="indirizzo" className={inputCls} defaultValue={cliente?.indirizzo ?? ""} placeholder="Via Roma 12" />
          </Field>
          <Field label="Scala / appartamento" className="sm:col-span-2">
            <input name="indirizzo2" className={inputCls} defaultValue={cliente?.indirizzo2 ?? ""} placeholder="Scala B, interno 4" />
          </Field>
          <Field label="Città">
            <input name="citta" className={inputCls} defaultValue={cliente?.citta ?? ""} placeholder="Milano" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CAP">
              <input name="cap" className={inputCls} maxLength={5} defaultValue={cliente?.cap ?? ""} placeholder="20100" />
            </Field>
            <Field label="Prov.">
              <input name="provincia" className={`${inputCls} uppercase`} maxLength={2} defaultValue={cliente?.provincia ?? ""} placeholder="MI" />
            </Field>
          </div>
          <Field label="Nazione" hint="Vuoto = Italia.">
            <input name="nazione" className={inputCls} defaultValue={cliente?.nazione ?? ""} placeholder="Italia" />
          </Field>
        </div>
      </Card>

      {/* 4 · Sconti e fatturazione (M1 §2 e §4) */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Sconti e fatturazione
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Assicurazione"
            hint="Vuoto = da rilevare. «NESSUNA» vuol dire chiesto: non ne ha."
            className="sm:col-span-2"
          >
            <select
              name="assicurazione_id"
              className={inputCls}
              defaultValue={cliente?.assicurazione_id ?? ""}
            >
              <option value="">— da rilevare</option>
              {assicurazioni.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Ragione sociale"
            hint="Solo se la fattura va intestata a un'azienda."
            className="sm:col-span-2"
          >
            <input name="ragione_sociale" className={inputCls} defaultValue={fatt.ragione_sociale ?? ""} placeholder="Bianchi SRL" />
          </Field>
          <Field label="CF / P.IVA azienda">
            <input name="piva_azienda" className={`${inputCls} f-mono uppercase`} maxLength={16} defaultValue={fatt.cf_piva ?? ""} placeholder="12345678901" />
          </Field>
          <Field label="Codice SDI" hint="Sette caratteri per la fattura elettronica.">
            <input name="codice_sdi" className={`${inputCls} f-mono uppercase`} maxLength={7} defaultValue={fatt.codice_sdi ?? ""} placeholder="ABCDEFG" />
          </Field>
        </div>
      </Card>

      {/* 5 · Provenienza e note */}
      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Provenienza e note
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fonte" hint="Da dove arriva il cliente — alimenta il ROI.">
            {cliente && !(FONTI_MANUALI as readonly string[]).includes(cliente.fonte) ? (
              // Fonte assegnata dal sistema (es. portale, QR): non deve poter
              // retrocedere a "banco". La mostro in sola lettura e la rimando
              // invariata con un campo nascosto.
              <>
                <p className={`${inputCls} bg-carta text-soft`} aria-label="fonte">
                  {ETICHETTE_FONTE[cliente.fonte] ?? cliente.fonte}
                </p>
                <input type="hidden" name="fonte" value={cliente.fonte} />
              </>
            ) : (
              <select name="fonte" className={inputCls} defaultValue={cliente?.fonte ?? "banco"} aria-label="fonte">
                {FONTI_MANUALI.map((f) => (
                  <option key={f} value={f}>
                    {ETICHETTE_FONTE[f]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Lingua" hint="Vuoto = italiano.">
            <input name="lingua" className={inputCls} defaultValue={cliente?.lingua ?? ""} placeholder="Italiano" />
          </Field>
          {/* Il consenso marketing NON si spunta più qui: è la proiezione
              dell'ultimo evento del mastro (contratto C3) e si raccoglie o si
              revoca dalla sezione «Permessi» della scheda cliente. */}
          <p className="self-end rounded-xl border border-linea bg-carta px-3.5 py-3 text-xs text-faint sm:col-span-2">
            Il consenso alle comunicazioni si raccoglie e si revoca dalla scheda
            del cliente, sezione <strong className="text-soft">Permessi</strong>:
            lì resta scritto quando è stato dato, come e per quali canali.
          </p>
        </div>
        <Field label="Note">
          <textarea name="note" rows={3} className={inputCls} defaultValue={cliente?.note ?? ""} placeholder="Preferenze, sensibilità, cose da ricordare al banco…" />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50"
        >
          {inCorso ? "Salvo…" : cliente ? "Salva modifiche" : "Crea cliente"}
        </button>
      </div>
    </form>
  );
}
