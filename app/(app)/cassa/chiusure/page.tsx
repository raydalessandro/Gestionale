import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Vuoto } from "@/components/ui";
import { fmtEuro, fmtData } from "@/lib/utils";

type Quad = { differenza: number };

export default async function ChiusureStoricoPage() {
  const supabase = await createClient();
  const { data: chiusure } = await supabase
    .from("chiusure_cassa")
    .select("id, data, versamento, riepilogo, chiusa_da")
    .order("data", { ascending: false })
    .limit(60);

  const rows = chiusure ?? [];
  const utenteIds = [...new Set(rows.map((c) => c.chiusa_da).filter(Boolean))] as string[];
  const { data: utenti } = utenteIds.length ? await supabase.from("utenti").select("id, nome").in("id", utenteIds) : { data: [] };
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome]));

  return (
    <>
      <PageHeader titolo="Chiusure di cassa" sotto="Lo storico delle giornate." />

      {rows.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {rows.map((c) => {
            const rie = (c.riepilogo ?? {}) as { quadratura?: Quad[] };
            const squadro = Math.round((rie.quadratura ?? []).reduce((s, q) => s + (q.differenza ?? 0), 0) * 100) / 100;
            return (
              <Link key={c.id} href={`/cassa/chiusure/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-carta">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-inchiostro">{fmtData(c.data)}</p>
                  <p className="text-[11px] text-faint">{c.chiusa_da && nomeUtente.get(c.chiusa_da) ? nomeUtente.get(c.chiusa_da) : ""}</p>
                </div>
                {Math.abs(squadro) > 0.05 ? (
                  <Badge tinta="rosso">squadro {fmtEuro(squadro)}</Badge>
                ) : (
                  <span className="text-[11px] text-faint">±{Math.abs(squadro).toFixed(2)}</span>
                )}
                <span className="f-mono text-sm tabular-nums text-inchiostro">vers. {fmtEuro(c.versamento)}</span>
              </Link>
            );
          })}
        </Card>
      ) : (
        <Vuoto titolo="Nessuna chiusura" testo="Le giornate chiuse compariranno qui." />
      )}
    </>
  );
}
