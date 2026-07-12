"use client";

import { useActionState } from "react";
import { creaCliente, aggiornaCliente } from "@/lib/actions";
import type { ClienteRow } from "@/lib/database.types";
import { Card, Field, inputCls, Errore } from "@/components/ui";

export default function ClienteForm({ cliente }: { cliente?: ClienteRow }) {
  const azioneBound = cliente
    ? aggiornaCliente.bind(null, cliente.id)
    : creaCliente;
  const [stato, azione, inCorso] = useActionState(azioneBound, null);

  return (
    <form action={azione} className="space-y-4">
      <Errore msg={stato?.errore} />

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Anagrafica
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <input
              name="nome"
              required
              className={inputCls}
              defaultValue={cliente?.nome ?? ""}
              placeholder="Laura"
            />
          </Field>
          <Field label="Cognome *">
            <input
              name="cognome"
              required
              className={inputCls}
              defaultValue={cliente?.cognome ?? ""}
              placeholder="Bianchi"
            />
          </Field>
          <Field label="Data di nascita">
            <input
              name="data_nascita"
              type="date"
              className={inputCls}
              defaultValue={cliente?.data_nascita ?? ""}
            />
          </Field>
          <Field label="Codice fiscale" hint="Servirà per Tessera Sanitaria e fatturazione.">
            <input
              name="codice_fiscale"
              className={`${inputCls} f-mono uppercase`}
              maxLength={16}
              defaultValue={cliente?.codice_fiscale ?? ""}
              placeholder="BNCLRA85M50F205Z"
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Contatti
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefono">
            <input
              name="telefono"
              type="tel"
              className={inputCls}
              defaultValue={cliente?.telefono ?? ""}
              placeholder="+39 333 1234567"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              className={inputCls}
              defaultValue={cliente?.email ?? ""}
              placeholder="laura@esempio.it"
            />
          </Field>
          <Field label="Indirizzo" className="sm:col-span-2">
            <input
              name="indirizzo"
              className={inputCls}
              defaultValue={cliente?.indirizzo ?? ""}
              placeholder="Via Roma 12"
            />
          </Field>
          <Field label="Città">
            <input
              name="citta"
              className={inputCls}
              defaultValue={cliente?.citta ?? ""}
              placeholder="Milano"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CAP">
              <input
                name="cap"
                className={inputCls}
                maxLength={5}
                defaultValue={cliente?.cap ?? ""}
                placeholder="20100"
              />
            </Field>
            <Field label="Prov.">
              <input
                name="provincia"
                className={`${inputCls} uppercase`}
                maxLength={2}
                defaultValue={cliente?.provincia ?? ""}
                placeholder="MI"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Origine e consensi
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fonte" hint="Da dove arriva il cliente — alimenta il ROI.">
            <select
              name="fonte"
              className={inputCls}
              defaultValue={cliente?.fonte ?? "banco"}
            >
              <option value="banco">Banco</option>
              <option value="sito">Dal sito</option>
              <option value="app">Dall&apos;app</option>
              <option value="convenzione">Convenzione</option>
              <option value="import">Import</option>
            </select>
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-linea bg-carta px-3.5 py-3">
            <input
              type="checkbox"
              name="consenso_marketing"
              defaultChecked={cliente?.consenso_marketing ?? false}
              className="mt-0.5 h-4 w-4 accent-[#A67C42]"
            />
            <span className="text-sm text-inchiostro">
              Consenso marketing
              <span className="block text-xs text-faint">
                Necessario per richiami e promozioni (modulo Recall).
              </span>
            </span>
          </label>
        </div>
        <Field label="Note">
          <textarea
            name="note"
            rows={3}
            className={inputCls}
            defaultValue={cliente?.note ?? ""}
            placeholder="Preferenze, sensibilità, cose da ricordare al banco…"
          />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50"
        >
          {inCorso
            ? "Salvo…"
            : cliente
              ? "Salva modifiche"
              : "Crea cliente"}
        </button>
      </div>
    </form>
  );
}
