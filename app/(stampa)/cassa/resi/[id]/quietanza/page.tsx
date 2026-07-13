import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottoneStampa from "@/components/BottoneStampa";
import { fmtEuro, fmtData } from "@/lib/utils";

export default async function QuietanzaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: r } = await supabase.from("resi").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [{ data: cliente }, { data: azienda }] = await Promise.all([
    r.cliente_id ? supabase.from("clienti").select("nome, cognome").eq("id", r.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("aziende").select("nome, ragione_sociale, indirizzo, citta, partita_iva").eq("id", r.azienda_id).maybeSingle(),
  ]);

  const ragione = azienda?.ragione_sociale || azienda?.nome || "il negozio";
  const nomeCliente = cliente ? `${cliente.cognome} ${cliente.nome}` : "il cliente";

  const Blocco = ({ copia }: { copia: string }) => (
    <div className="border border-neutral-300 p-4">
      <div className="flex items-start justify-between border-b border-black pb-2">
        <p className="text-base font-bold uppercase">{azienda?.nome ?? "Ottica"}</p>
        <p className="text-[10px] uppercase tracking-widest text-neutral-600">{copia}</p>
      </div>
      <p className="mt-3 text-xs uppercase tracking-widest text-neutral-600">Quietanza di restituzione caparra · {r.numero}</p>
      <p className="mt-3 text-[13px] leading-relaxed">
        Il/la sottoscritto/a <span className="font-semibold">{nomeCliente}</span> dichiara di ricevere da{" "}
        <span className="font-semibold">{ragione}</span> la restituzione della caparra rilasciata in questo
        negozio, pari a <span className="font-mono font-semibold">{fmtEuro(r.importo)}</span>
        {r.metodo_rimborso ? ` (${r.metodo_rimborso})` : ""}
        {r.doc_origine_numero ? `, riferita all'ordine ${r.doc_origine_numero}` : ""}.
      </p>
      <p className="mt-1 text-xs text-neutral-600">Data: {fmtData(r.created_at)}</p>
      {copia === "Copia cliente" ? (
        <div className="mt-10"><div className="border-t border-black" /><p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">Firma per quietanza</p></div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div><div className="border-t border-black" /><p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">Firma Cliente</p></div>
          <div><div className="border-t border-black" /><p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">Firma Dipendente</p></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-[210mm] space-y-6 p-8 font-serif text-black">
      <BottoneStampa />
      <Blocco copia="Copia cliente" />
      <Blocco copia="Copia negozio" />
    </div>
  );
}
