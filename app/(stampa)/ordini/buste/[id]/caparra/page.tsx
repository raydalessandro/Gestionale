import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottoneStampa from "@/components/BottoneStampa";
import { fmtEuro, fmtData } from "@/lib/utils";

export default async function RicevutaCaparraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: b } = await supabase.from("ordini_occhiali").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();

  const [{ data: cliente }, { data: azienda }] = await Promise.all([
    b.cliente_id ? supabase.from("clienti").select("nome, cognome").eq("id", b.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("aziende").select("nome, indirizzo, citta, partita_iva").eq("id", b.azienda_id).maybeSingle(),
  ]);

  const inAttesa = b.totale - b.acconto;
  const righe = [
    b.prezzo_montatura > 0 && { d: `Montatura ${[b.montatura_marca, b.montatura_modello].filter(Boolean).join(" ")}`.trim(), v: b.prezzo_montatura },
    b.prezzo_lenti > 0 && { d: `Lenti${b.lente_tipo ? ` ${b.lente_tipo}` : ""}`, v: b.prezzo_lenti },
    b.prezzo_extra > 0 && { d: b.garanzia ? `Extra / ${b.garanzia}` : "Extra", v: b.prezzo_extra },
  ].filter(Boolean) as { d: string; v: number }[];

  return (
    <div className="mx-auto max-w-[210mm] p-8 font-serif text-[13px] leading-relaxed text-black">
      <BottoneStampa />

      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-lg font-bold uppercase tracking-wide">{azienda?.nome ?? "Ottica"}</p>
          {azienda?.indirizzo && <p className="text-xs text-neutral-600">{[azienda.indirizzo, azienda.citta].filter(Boolean).join(", ")}</p>}
          {azienda?.partita_iva && <p className="text-xs text-neutral-600">P.IVA {azienda.partita_iva}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-neutral-600">Ricevuta di caparra</p>
          <p className="font-mono text-xl font-bold">{b.numero}</p>
        </div>
      </div>

      <p className="mt-4">
        Ordine per: <span className="font-semibold">{cliente ? `${cliente.cognome} ${cliente.nome}` : "—"}</span>
        <span className="float-right text-xs">Data: {fmtData(b.created_at)}</span>
      </p>

      <table className="mt-4 w-full text-[13px]">
        <tbody>
          {righe.map((r, i) => (
            <tr key={i} className="border-b border-neutral-300">
              <td className="py-1">{r.d}</td>
              <td className="py-1 text-right font-mono">{fmtEuro(r.v)}</td>
            </tr>
          ))}
          {righe.length === 0 && (
            <tr className="border-b border-neutral-300"><td className="py-1">Occhiale {b.numero}</td><td className="py-1 text-right font-mono">{fmtEuro(b.totale)}</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 font-mono text-[13px]">
        <div className="flex justify-between"><span>Totale</span><span>{fmtEuro(b.totale)}</span></div>
        <div className="flex justify-between font-bold"><span>Caparra versata</span><span>{fmtEuro(b.acconto)}</span></div>
        <div className="flex justify-between"><span>In attesa di pagamento</span><span>{fmtEuro(inAttesa)}</span></div>
      </div>

      <div className="mt-6 border-t border-neutral-300 pt-3 text-[11px] leading-relaxed text-neutral-700">
        <p>
          La presente ricevuta è rilasciata a titolo di <strong>caparra confirmatoria</strong> ai sensi
          dell&apos;art. 1385 c.c. La somma non è soggetta a IVA ex art. 2 DPR 633/1972 (R.M. 19/5/1977 n. 411673).
        </p>
        <p className="mt-1">
          In caso di mancato ritiro dell&apos;ordine entro <strong>due mesi</strong> dalla data promessa, previi
          tentativi documentati di avviso, la caparra potrà essere trattenuta a titolo definitivo.
        </p>
        <p className="mt-1">Marca da bollo assolta sulla copia rilasciata al cliente ove dovuta.</p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <div><div className="mt-8 border-t border-black" /><p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">Data</p></div>
        <div><div className="mt-8 border-t border-black" /><p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">Firma</p></div>
      </div>
    </div>
  );
}
