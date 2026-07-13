import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { etichettaCausaleReso } from "@/components/CassaUI";
import { fmtEuro, fmtData, fmtQuando } from "@/lib/utils";

export default async function ResoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: r } = await supabase.from("resi").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [{ data: cliente }, { data: vendita }] = await Promise.all([
    r.cliente_id ? supabase.from("clienti").select("id, nome, cognome").eq("id", r.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    r.vendita_id ? supabase.from("vendite").select("id, numero").eq("id", r.vendita_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader
        titolo=""
        azione={r.tipo === "denaro" ? <ButtonLink href={`/cassa/resi/${r.id}/quietanza`} variante="ghost"><Printer size={15} /> Quietanza</ButtonLink> : undefined}
      />
      <div className="-mt-2 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="f-mono text-3xl font-semibold text-inchiostro">{r.numero}</h1>
          <Badge tinta={r.tipo === "denaro" ? "ambra" : "neutro"}>{r.tipo === "denaro" ? "Rimborso" : "Gestionale"}</Badge>
        </div>
        <p className="mt-1 text-sm text-soft">{fmtQuando(r.created_at)}{cliente ? <> · <Link href={`/clienti/${cliente.id}`} className="hover:underline">{cliente.cognome} {cliente.nome}</Link></> : ""}</p>
      </div>

      <Card className="space-y-2 text-sm">
        <Riga label="Causale" valore={etichettaCausaleReso(r.causale)} />
        <Riga label="Importo" valore={fmtEuro(r.importo)} mono />
        {r.metodo_rimborso && <Riga label="Rimborsato con" valore={r.metodo_rimborso} />}
        {vendita && <Riga label="Vendita d'origine" valore={vendita.numero} link={`/cassa/vendite/${vendita.id}`} />}
        {r.doc_origine_numero && <Riga label="Documento d'origine" valore={`${r.doc_origine_numero}${r.doc_origine_data ? ` · ${fmtData(r.doc_origine_data)}` : ""}`} />}
        {r.doc_numero && <Riga label="Documento reso (RT)" valore={`${r.doc_numero}${r.doc_data ? ` · ${fmtData(r.doc_data)}` : ""}`} />}
        {r.note && <p className="whitespace-pre-wrap pt-2 text-xs text-soft">{r.note}</p>}
      </Card>
    </>
  );
}

function Riga({ label, valore, mono, link }: { label: string; valore: string; mono?: boolean; link?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-soft">{label}</span>
      {link ? (
        <Link href={link} className={`${mono ? "f-mono" : ""} font-semibold text-inchiostro hover:underline`}>{valore}</Link>
      ) : (
        <span className={`${mono ? "f-mono tabular-nums" : ""} text-inchiostro`}>{valore}</span>
      )}
    </div>
  );
}
