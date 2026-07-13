"use client";

import { useActionState, useState } from "react";
import { creaProdotto, aggiornaProdotto } from "@/lib/actions";
import type { ProdottoRow } from "@/lib/database.types";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { parametriLac } from "@/components/MagazzinoUI";

const TIPI: { id: ProdottoRow["tipo"]; label: string }[] = [
  { id: "lac", label: "Lente a contatto" },
  { id: "soluzione", label: "Soluzione" },
  { id: "montatura", label: "Montatura" },
  { id: "lente", label: "Lente oftalmica" },
  { id: "accessorio", label: "Accessorio" },
  { id: "servizio", label: "Servizio" },
];

export default function ProdottoForm({ prodotto }: { prodotto?: ProdottoRow }) {
  const azione = prodotto
    ? aggiornaProdotto.bind(null, prodotto.id)
    : creaProdotto;
  const [stato, run, inCorso] = useActionState(azione, null);
  const [tipo, setTipo] = useState<ProdottoRow["tipo"]>(prodotto?.tipo ?? "lac");
  const lac = parametriLac(prodotto?.parametri);

  return (
    <form action={run} className="space-y-4">
      <Errore msg={stato?.errore} />

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Anagrafica
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo *">
            <select
              name="tipo"
              className={inputCls}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ProdottoRow["tipo"])}
            >
              {TIPI.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marca">
            <input name="marca" className={inputCls} defaultValue={prodotto?.marca ?? ""} placeholder="Acuvue" />
          </Field>
          <Field label="Nome *" className="sm:col-span-2">
            <input name="nome" required className={inputCls} defaultValue={prodotto?.nome ?? ""} placeholder="Oasys 1-Day 30pz" />
          </Field>
          <Field label="Descrizione" className="sm:col-span-2">
            <textarea name="descrizione" rows={2} className={inputCls} defaultValue={prodotto?.descrizione ?? ""} />
          </Field>
          <Field label="SKU / barcode" hint="EAN/UPC — univoco per negozio.">
            <input name="sku" className={`${inputCls} f-mono`} defaultValue={prodotto?.sku ?? ""} placeholder="733905…" />
          </Field>
          <Field label="Fornitore">
            <input name="fornitore" className={inputCls} defaultValue={prodotto?.fornitore ?? ""} placeholder="Johnson & Johnson" />
          </Field>
        </div>
      </Card>

      {tipo === "lac" && (
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Parametri lente a contatto
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Raggio (BC)">
              <input name="par_raggio" type="number" step="0.1" inputMode="decimal" className={`${inputCls} diottria`} defaultValue={lac.raggio ?? ""} placeholder="8.6" />
            </Field>
            <Field label="Diametro (DIA)">
              <input name="par_diametro" type="number" step="0.1" inputMode="decimal" className={`${inputCls} diottria`} defaultValue={lac.diametro ?? ""} placeholder="14.2" />
            </Field>
            <Field label="Confezione">
              <input name="par_confezione" className={inputCls} defaultValue={lac.confezione ?? ""} placeholder="×6" />
            </Field>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Prezzi e scorta
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Prezzo (€) *">
            <input name="prezzo" type="number" step="0.01" min={0} required className={`${inputCls} diottria`} defaultValue={prodotto?.prezzo ?? 0} />
          </Field>
          <Field label="Costo (€)" hint="Facoltativo.">
            <input name="costo" type="number" step="0.01" min={0} className={`${inputCls} diottria`} defaultValue={prodotto?.costo ?? ""} />
          </Field>
          <Field label="Scorta minima" hint="0 = nessun avviso.">
            <input name="scorta_minima" type="number" step="1" min={0} className={`${inputCls} diottria`} defaultValue={prodotto?.scorta_minima ?? 0} />
          </Field>
        </div>
        {prodotto && (
          <p className="text-xs text-faint">
            Giacenza attuale: <span className="f-mono font-semibold text-inchiostro">{prodotto.giacenza}</span> — si cambia solo dalla scheda con un movimento.
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="visibile_sito" defaultChecked={prodotto?.visibile_sito ?? false} className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
          <span className="text-sm text-inchiostro">
            Visibile sul sito pubblico
            <span className="block text-xs text-faint">
              Comparirà sul sito quando attiveremo l&apos;integrazione — Fase 6.
            </span>
          </span>
        </label>
        {prodotto && (
          <label className="flex items-start gap-3">
            <input type="checkbox" name="attivo" defaultChecked={prodotto.attivo} className="mt-0.5 h-4 w-4 accent-[#A67C42]" />
            <span className="text-sm text-inchiostro">
              Prodotto attivo
              <span className="block text-xs text-faint">
                Disattivandolo sparisce da ricerche e wizard, ma resta nella storia.
              </span>
            </span>
          </label>
        )}
      </Card>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-xl bg-inchiostro px-5 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50"
        >
          {inCorso ? "Salvo…" : prodotto ? "Salva modifiche" : "Crea prodotto"}
        </button>
      </div>
    </form>
  );
}
