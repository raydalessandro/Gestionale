import Link from "next/link";
import { Plus, Settings, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, ButtonLink, Vuoto } from "@/components/ui";
import { PillStatoVendita } from "@/components/CassaUI";
import { TIPI_MOVIMENTO_CASSA } from "@/lib/utils";
import FormMovimentoCassa from "@/components/FormMovimentoCassa";
import { fmtEuro, fmtQuando } from "@/lib/utils";
import type { PagamentoVendita } from "@/lib/database.types";

export default async function CassaPage() {
  const supabase = await createClient();
  const oggi = new Date().toISOString().slice(0, 10);
  const inizio = `${oggi}T00:00:00`;
  const fine = `${oggi}T23:59:59`;

  const [{ data: vendite }, { data: movimenti }, { data: chiusuraOggi }, { data: ultimaChiusura }, { data: ordiniOggi }, { data: incameri }] =
    await Promise.all([
      supabase.from("vendite").select("id, numero, cliente_id, totale, stato, data_vendita, pagamenti").gte("data_vendita", inizio).lte("data_vendita", fine).order("data_vendita", { ascending: false }),
      supabase.from("movimenti_cassa").select("id, tipo, importo, motivo, riferimento, created_at").gte("created_at", inizio).lte("created_at", fine).order("created_at", { ascending: false }),
      supabase.from("chiusure_cassa").select("id").eq("data", oggi).maybeSingle(),
      supabase.from("chiusure_cassa").select("fondo_chiusura").order("data", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ordini_occhiali").select("acconto").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("movimenti_cassa").select("importo").eq("tipo", "incamero_caparra").gte("created_at", inizio).lte("created_at", fine),
    ]);

  const venditeEmesse = (vendite ?? []).filter((v) => v.stato === "emessa");
  const incassoOggi = venditeEmesse.reduce((s, v) => s + v.totale, 0);

  // Totali per metodo + caparre scalate
  const perMetodo = new Map<string, number>();
  let caparreScalate = 0;
  for (const v of venditeEmesse) {
    for (const p of (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[]) {
      perMetodo.set(p.nome, (perMetodo.get(p.nome) ?? 0) + p.importo);
      if (p.nome.toLowerCase() === "caparra") caparreScalate += p.importo;
    }
  }
  const contantiVendite = perMetodo.get("Contanti") ?? 0;
  const prelieviSpese = (movimenti ?? []).filter((m) => m.tipo === "prelievo" || m.tipo === "spesa").reduce((s, m) => s + m.importo, 0);
  const fondoApertura = ultimaChiusura?.fondo_chiusura ?? 300;
  const contantiAttesi = fondoApertura + contantiVendite - prelieviSpese;

  const caparreEmesse = (ordiniOggi ?? []).reduce((s, o) => s + (o.acconto ?? 0), 0);
  const caparreIncamerate = (incameri ?? []).reduce((s, m) => s + m.importo, 0);

  const clienteIds = [...new Set(venditeEmesse.map((v) => v.cliente_id).filter(Boolean))] as string[];
  const { data: clienti } = clienteIds.length ? await supabase.from("clienti").select("id, nome, cognome").in("id", clienteIds) : { data: [] };
  const nomeCliente = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));

  return (
    <>
      <PageHeader
        titolo="Cassa"
        sotto="La giornata, a colpo d'occhio."
        azione={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/cassa/vendita/nuova" variante="accent"><Plus size={16} /> Vendita veloce</ButtonLink>
            {chiusuraOggi ? (
              <ButtonLink href={`/cassa/chiusure/${chiusuraOggi.id}`} variante="ghost">Chiusura di oggi ✓</ButtonLink>
            ) : (
              <ButtonLink href="/cassa/chiusura" variante="ghost">Chiudi la giornata</ButtonLink>
            )}
            <ButtonLink href="/cassa/impostazioni" variante="ghost"><Settings size={15} /></ButtonLink>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <NumeroCard valore={fmtEuro(incassoOggi)} label="Incasso di oggi" />
        <NumeroCard valore={String(venditeEmesse.length)} label="Vendite" />
        <NumeroCard valore={fmtEuro(contantiAttesi)} label="Contanti attesi" />
      </div>

      {perMetodo.size > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Totali per metodo</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {[...perMetodo.entries()].map(([nome, imp]) => (
              <div key={nome} className="flex justify-between text-sm">
                <span className="text-soft">{nome}</span>
                <span className="f-mono tabular-nums text-inchiostro">{fmtEuro(imp)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Vendite di oggi */}
        <Card className="!p-0">
          <p className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint">Vendite di oggi</p>
          {venditeEmesse.length > 0 || (vendite ?? []).length > 0 ? (
            <div className="divide-y divide-linea">
              {(vendite ?? []).map((v) => (
                <Link key={v.id} href={`/cassa/vendite/${v.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-carta">
                  <div className="min-w-0 flex-1">
                    <span className="f-mono text-sm font-semibold text-inchiostro">{v.numero}</span>
                    <span className="ml-2 text-sm text-soft">{(v.cliente_id && nomeCliente.get(v.cliente_id)) || "Non associato"}</span>
                    <p className="text-[11px] text-faint">{fmtQuando(v.data_vendita)}</p>
                  </div>
                  <span className="f-mono text-sm tabular-nums text-inchiostro">{fmtEuro(v.totale)}</span>
                  <PillStatoVendita stato={v.stato} />
                  <ChevronRight size={15} className="shrink-0 text-faint" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5"><Vuoto titolo="Ancora niente" testo="La prima vendita di oggi comparirà qui." azione={<ButtonLink href="/cassa/vendita/nuova" variante="ghost"><Plus size={16} /> Vendita veloce</ButtonLink>} /></div>
          )}
        </Card>

        {/* Movimenti di cassa */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Movimenti di cassa</p>
          </div>
          {(movimenti ?? []).length > 0 ? (
            <ul className="divide-y divide-linea/70">
              {(movimenti ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-inchiostro">{TIPI_MOVIMENTO_CASSA[m.tipo] ?? m.tipo}</p>
                    <p className="truncate text-[11px] text-faint">{m.motivo}{m.riferimento ? ` · ${m.riferimento}` : ""}</p>
                  </div>
                  <span className="f-mono text-sm tabular-nums text-soft">{fmtEuro(m.importo)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Nessun movimento oggi.</p>
          )}
          <FormMovimentoCassa />
        </Card>
      </div>

      {(caparreEmesse > 0 || caparreScalate > 0 || caparreIncamerate > 0) && (
        <p className="text-xs text-faint">
          Caparre di oggi — emesse {fmtEuro(caparreEmesse)} · scalate {fmtEuro(caparreScalate)} · incamerate {fmtEuro(caparreIncamerate)}
        </p>
      )}
    </>
  );
}

function NumeroCard({ valore, label }: { valore: string; label: string }) {
  return (
    <div className="rounded-2xl border border-linea bg-white p-4 shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <p className="f-mono text-xl font-semibold tabular-nums text-inchiostro sm:text-2xl">{valore}</p>
      <p className="mt-1 text-xs font-medium text-soft">{label}</p>
    </div>
  );
}
