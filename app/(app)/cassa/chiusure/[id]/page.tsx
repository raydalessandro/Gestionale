import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge } from "@/components/ui";
import { fmtEuro, fmtData, ETICHETTE_ALIQUOTA } from "@/lib/utils";

type Riepilogo = {
  quadratura?: { metodo: string; sistema: number; dichiarato: number; differenza: number; causale: string | null }[];
  confronto_rt?: { aliquota: string; stampante: number; sistema: number; differenza: number }[];
  caparre?: { emesse: number; scontate: number; incamerate: number };
};

export default async function ChiusuraDettaglioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("chiusure_cassa").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const rie = (c.riepilogo ?? {}) as Riepilogo;
  const squadro = Math.round((rie.quadratura ?? []).reduce((s, q) => s + (q.differenza ?? 0), 0) * 100) / 100;

  return (
    <>
      <PageHeader titolo={`Chiusura ${fmtData(c.data)}`} azione={Math.abs(squadro) > 0.05 ? <Badge tinta="rosso">squadro {fmtEuro(squadro)}</Badge> : <Badge tinta="verde">quadrata</Badge>} />

      <Card className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">1 · Conta per metodo</p>
        {(rie.quadratura ?? []).map((q, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-inchiostro">{q.metodo}{q.causale ? <span className="text-xs text-faint"> · {q.causale}</span> : ""}</span>
            <span className="flex gap-3 f-mono tabular-nums">
              <span className="text-faint">sist. {fmtEuro(q.sistema)}</span>
              <span className="text-soft">dich. {fmtEuro(q.dichiarato)}</span>
              <span className={Math.abs(q.differenza) > 0.05 ? "text-rosso" : "text-verde"}>{q.differenza >= 0 ? "+" : ""}{q.differenza.toFixed(2)}</span>
            </span>
          </div>
        ))}
      </Card>

      <Card className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">2 · Confronto col registratore {c.z_numero ? `· Z ${c.z_numero}` : ""}</p>
        {(rie.confronto_rt ?? []).map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-inchiostro">{ETICHETTE_ALIQUOTA[r.aliquota] ?? r.aliquota}</span>
            <span className="flex gap-3 f-mono tabular-nums">
              <span className="text-faint">sist. {fmtEuro(r.sistema)}</span>
              <span className="text-soft">stamp. {fmtEuro(r.stampante)}</span>
              <span className={Math.abs(r.differenza) > 0.05 ? "text-rosso" : "text-verde"}>{r.differenza >= 0 ? "+" : ""}{r.differenza.toFixed(2)}</span>
            </span>
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-1.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">3 · Cassaforte</p>
          <div className="flex justify-between"><span className="text-soft">Fondo apertura</span><span className="f-mono">{fmtEuro(c.fondo_apertura)}</span></div>
          <div className="flex justify-between"><span className="text-soft">Contanti contati</span><span className="f-mono">{fmtEuro(c.contanti_contati)}</span></div>
          <div className="flex justify-between"><span className="text-soft">Fondo che resta</span><span className="f-mono">{fmtEuro(c.fondo_chiusura)}</span></div>
          <div className="flex justify-between border-t border-linea pt-1 font-semibold"><span className="text-inchiostro">Versamento</span><span className="f-mono">{fmtEuro(c.versamento)}</span></div>
        </Card>
        <Card className="space-y-1.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">4 · Caparre</p>
          <div className="flex justify-between"><span className="text-soft">Emesse</span><span className="f-mono">{fmtEuro(rie.caparre?.emesse ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-soft">Scalate</span><span className="f-mono">{fmtEuro(rie.caparre?.scontate ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-soft">Incamerate</span><span className="f-mono">{fmtEuro(rie.caparre?.incamerate ?? 0)}</span></div>
          {c.note && <p className="whitespace-pre-wrap pt-2 text-xs text-soft">{c.note}</p>}
        </Card>
      </div>
    </>
  );
}
