import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge } from "@/components/ui";
import { PillStatoVendita, etichettaAliquota } from "@/components/CassaUI";
import { AnnullaVendita, RegistraReso } from "@/components/AzioniVendita";
import { etichettaCausaleReso } from "@/components/CassaUI";
import { fmtEuro, fmtData, fmtQuando } from "@/lib/utils";
import type { RigaVendita, PagamentoVendita } from "@/lib/database.types";

export default async function VenditaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: v } = await supabase.from("vendite").select("*").eq("id", id).maybeSingle();
  if (!v) notFound();

  const [{ data: cliente }, { data: resi }, { data: metodi }] = await Promise.all([
    v.cliente_id ? supabase.from("clienti").select("id, nome, cognome").eq("id", v.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("resi").select("id, numero, tipo, causale, importo, created_at").eq("vendita_id", id).order("created_at", { ascending: false }),
    supabase.from("metodi_pagamento").select("id, nome").eq("attivo", true).order("ordine"),
  ]);

  const righe = (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[];
  const pagamenti = (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[];

  return (
    <>
      <PageHeader
        titolo=""
        azione={<PillStatoVendita stato={v.stato} />}
      />
      <div className="-mt-2 mb-6">
        <h1 className="f-mono text-3xl font-semibold text-inchiostro">{v.numero}</h1>
        <p className="mt-1 text-sm text-soft">
          {fmtQuando(v.data_vendita)} · {cliente ? <Link href={`/clienti/${cliente.id}`} className="hover:underline">{cliente.cognome} {cliente.nome}</Link> : "Non associato"}
          {v.origine === "riallineamento" && <Badge tinta="ambra">Riallineamento</Badge>}
        </p>
      </div>

      <Card className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="py-2 font-semibold">Descrizione</th>
              <th className="py-2 font-semibold">Aliq.</th>
              <th className="py-2 text-right font-semibold">Q.tà</th>
              <th className="py-2 text-right font-semibold">Prezzo</th>
              <th className="py-2 text-right font-semibold">Sconto</th>
              <th className="py-2 text-right font-semibold">Subtot.</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={i} className="border-b border-linea/60">
                <td className="py-2 text-inchiostro">{r.descrizione}{r.dm && <span className="ml-1 text-[10px] font-semibold text-ottone-scuro">DM</span>}</td>
                <td className="py-2 text-soft">{etichettaAliquota(r.aliquota)}</td>
                <td className="py-2 text-right f-mono tabular-nums">{r.quantita}</td>
                <td className="py-2 text-right f-mono tabular-nums">{fmtEuro(r.prezzo_unitario)}</td>
                <td className="py-2 text-right f-mono tabular-nums">{r.sconto > 0 ? fmtEuro(r.sconto) : "—"}</td>
                <td className="py-2 text-right f-mono tabular-nums">{fmtEuro(Math.max(0, r.quantita * r.prezzo_unitario - r.sconto))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between border-t border-linea pt-3">
          <span className="text-xs text-faint">di cui IVA {fmtEuro(v.iva_totale)}</span>
          <span className="f-mono text-lg font-semibold tabular-nums text-inchiostro">{fmtEuro(v.totale)}</span>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Pagamenti</p>
          {pagamenti.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-soft">{p.nome}</span>
              <span className="f-mono tabular-nums text-inchiostro">{fmtEuro(p.importo)}</span>
            </div>
          ))}
        </Card>
        <Card className="space-y-1.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Documento</p>
          <p className="text-soft">RT: <span className="f-mono text-inchiostro">{v.doc_numero || "—"}</span>{v.doc_data ? ` · ${fmtData(v.doc_data)}` : ""}</p>
          {v.fattura_numero && <p className="text-soft">Fattura: <span className="f-mono text-inchiostro">{v.fattura_numero}</span></p>}
          {v.cf_cliente && <p className="text-soft">CF: <span className="f-mono text-inchiostro">{v.cf_cliente}</span></p>}
          {v.opposizione_ts && <p className="text-xs text-faint">Opposizione Sistema TS</p>}
        </Card>
      </div>

      {v.stato === "emessa" && (
        <Card className="mb-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Azioni</p>
          <div className="flex flex-wrap items-start gap-2">
            <RegistraReso venditaId={v.id} clienteId={v.cliente_id} righe={righe} totale={v.totale} metodi={metodi ?? []} />
            <AnnullaVendita id={v.id} />
          </div>
        </Card>
      )}

      {resi && resi.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Resi collegati</p>
          {resi.map((r) => (
            <Link key={r.id} href={`/cassa/resi/${r.id}`} className="flex items-center justify-between text-sm hover:underline">
              <span className="f-mono text-inchiostro">{r.numero}</span>
              <span className="text-soft">{etichettaCausaleReso(r.causale)} · {fmtEuro(r.importo)} · {fmtData(r.created_at)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
