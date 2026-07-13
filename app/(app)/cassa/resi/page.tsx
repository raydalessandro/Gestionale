import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Vuoto } from "@/components/ui";
import { etichettaCausaleReso } from "@/components/CassaUI";
import ResoEsterno from "@/components/ResoEsterno";
import { fmtEuro, fmtQuando } from "@/lib/utils";

export default async function ResiPage() {
  const supabase = await createClient();
  const [{ data: resi }, { data: metodi }] = await Promise.all([
    supabase.from("resi").select("id, numero, tipo, causale, importo, cliente_id, vendita_id, doc_origine_numero, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("metodi_pagamento").select("id, nome").eq("attivo", true).order("ordine"),
  ]);

  const rows = resi ?? [];
  const cliIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))] as string[];
  const { data: clienti } = cliIds.length ? await supabase.from("clienti").select("id, nome, cognome").in("id", cliIds) : { data: [] };
  const nomeCliente = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));

  return (
    <>
      <PageHeader titolo="Resi" sotto="Ogni reso ha la sua causale: è un dato, non una vergogna." />

      <div className="mb-4"><ResoEsterno metodi={metodi ?? []} /></div>

      {rows.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {rows.map((r) => (
            <Link key={r.id} href={`/cassa/resi/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-carta">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="f-mono text-sm font-semibold text-inchiostro">{r.numero}</span>
                  <Badge tinta={r.tipo === "denaro" ? "ambra" : "neutro"}>{r.tipo === "denaro" ? "Rimborso" : "Gestionale"}</Badge>
                  {r.cliente_id && <span className="text-sm text-soft">{nomeCliente.get(r.cliente_id)}</span>}
                </div>
                <p className="mt-0.5 text-xs text-faint">
                  {etichettaCausaleReso(r.causale)} · {fmtQuando(r.created_at)}
                  {r.doc_origine_numero ? ` · orig. ${r.doc_origine_numero}` : ""}
                </p>
              </div>
              <span className="f-mono text-sm tabular-nums text-inchiostro">{fmtEuro(r.importo)}</span>
            </Link>
          ))}
        </Card>
      ) : (
        <Vuoto titolo="Nessun reso" testo="I resi registrati compariranno qui." />
      )}
    </>
  );
}
