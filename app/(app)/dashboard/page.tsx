import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, ButtonLink, Badge, tintaFonte, Vuoto } from "@/components/ui";
import { fmtData, ETICHETTE_FONTE } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [clienti, prescrizioni, lac, buste, ultimi] = await Promise.all([
    supabase.from("clienti").select("*", { count: "exact", head: true }),
    supabase
      .from("prescrizioni")
      .select("*", { count: "exact", head: true })
      .gte("data_visita", trentaGiorniFa),
    supabase
      .from("ordini_lac")
      .select("*", { count: "exact", head: true })
      .in("stato", ["da_ordinare", "ordinato", "arrivato"]),
    supabase
      .from("ordini_occhiali")
      .select("*", { count: "exact", head: true })
      .in("stato", ["lavorazione", "pronta"]),
    supabase
      .from("clienti")
      .select("id, nome, cognome, fonte, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const kpi = [
    { label: "Clienti in anagrafica", value: clienti.count ?? 0 },
    { label: "Prescrizioni · 30 gg", value: prescrizioni.count ?? 0 },
    { label: "Ordini LAC attivi", value: lac.count ?? 0, nota: "modulo in arrivo · v0.2" },
    { label: "Buste in lavorazione", value: buste.count ?? 0, nota: "modulo in arrivo · v0.2" },
  ];

  return (
    <>
      <PageHeader
        titolo="Dashboard"
        sotto="Il polso del negozio, a colpo d'occhio."
        azione={
          <ButtonLink href="/clienti/nuovo" variante="accent">
            <UserPlus size={16} /> Nuovo cliente
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {kpi.map((k) => (
          <Card key={k.label} className="!p-4">
            <p className="f-mono text-3xl font-semibold tabular-nums text-inchiostro">
              {k.value}
            </p>
            <p className="mt-1 text-xs font-medium text-soft">{k.label}</p>
            {k.nota && <p className="mt-0.5 text-[10px] text-faint">{k.nota}</p>}
          </Card>
        ))}
      </div>

      <h2 className="f-serif mb-3 text-lg font-semibold text-inchiostro">
        Ultimi clienti
      </h2>

      {ultimi.data && ultimi.data.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {ultimi.data.map((c) => (
            <Link
              key={c.id}
              href={`/clienti/${c.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-carta"
            >
              <div>
                <p className="text-sm font-semibold text-inchiostro">
                  {c.cognome} {c.nome}
                </p>
                <p className="text-xs text-faint">{fmtData(c.created_at)}</p>
              </div>
              <Badge tinta={tintaFonte(c.fonte)}>
                {ETICHETTE_FONTE[c.fonte] ?? c.fonte}
              </Badge>
            </Link>
          ))}
        </Card>
      ) : (
        <Vuoto
          titolo="L'anagrafica è pronta"
          testo="Il primo cliente è a un tap di distanza — da lì partono prescrizioni, ordini e tutto il resto."
          azione={
            <ButtonLink href="/clienti/nuovo" variante="ghost">
              <Plus size={16} /> Aggiungi il primo cliente
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
