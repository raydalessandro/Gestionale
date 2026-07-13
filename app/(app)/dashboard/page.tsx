import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, ButtonLink, Badge, tintaFonte, Vuoto } from "@/components/ui";
import { sottoScorta } from "@/components/MagazzinoUI";
import { calcolaProposte } from "@/lib/richiami-proposte";
import { fmtData, fmtEuro, ETICHETTE_FONTE } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const oggi = new Date().toISOString().slice(0, 10);

  const [clienti, prescrizioni, lac, buste, ultimi, perScorta, appOggi, richDaFare, proposte, venditeOggi] = await Promise.all([
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
    supabase
      .from("prodotti")
      .select("giacenza, scorta_minima, attivo")
      .eq("attivo", true)
      .gt("scorta_minima", 0),
    supabase
      .from("appuntamenti")
      .select("*", { count: "exact", head: true })
      .gte("inizio", `${oggi}T00:00:00`)
      .lte("inizio", `${oggi}T23:59:59`)
      .eq("stato", "prenotato"),
    supabase
      .from("richiami")
      .select("*", { count: "exact", head: true })
      .is("esito", null)
      .lte("da_fare_il", oggi),
    calcolaProposte(supabase),
    supabase
      .from("vendite")
      .select("totale")
      .eq("stato", "emessa")
      .gte("data_vendita", `${oggi}T00:00:00`)
      .lte("data_vendita", `${oggi}T23:59:59`),
  ]);

  const nSottoScorta = (perScorta.data ?? []).filter((p) => sottoScorta(p)).length;
  const nAppOggi = appOggi.count ?? 0;
  const nRichiami = (richDaFare.count ?? 0) + proposte.proposte.length;
  const nVendite = (venditeOggi.data ?? []).length;
  const incassoOggi = (venditeOggi.data ?? []).reduce((s, v) => s + v.totale, 0);

  const kpi = [
    { label: "Clienti in anagrafica", value: clienti.count ?? 0 },
    { label: "Prescrizioni · 30 gg", value: prescrizioni.count ?? 0 },
    { label: "Ordini LAC attivi", value: lac.count ?? 0, href: "/ordini?vista=lac" },
    { label: "Buste in lavorazione", value: buste.count ?? 0, href: "/ordini?vista=buste" },
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
        {kpi.map((k) => {
          const contenuto = (
            <>
              <p className="f-mono text-3xl font-semibold tabular-nums text-inchiostro">
                {k.value}
              </p>
              <p className="mt-1 text-xs font-medium text-soft">{k.label}</p>
            </>
          );
          return k.href ? (
            <Link
              key={k.label}
              href={k.href}
              className="rounded-2xl border border-linea bg-white p-4 shadow-[0_1px_2px_rgba(28,23,20,0.04)] transition-colors hover:border-faint hover:bg-carta"
            >
              {contenuto}
            </Link>
          ) : (
            <Card key={k.label} className="!p-4">
              {contenuto}
            </Card>
          );
        })}
      </div>

      {nSottoScorta > 0 && (
        <Link
          href="/magazzino?vista=prodotti&filtro=sotto_scorta"
          className="mb-6 flex items-center justify-between gap-2 rounded-xl border border-ambra/40 bg-ambra-soft px-4 py-3 text-sm font-medium text-ambra transition-colors hover:border-ambra"
        >
          <span>
            {nSottoScorta} prodott{nSottoScorta === 1 ? "o" : "i"} sotto scorta
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {(nAppOggi > 0 || nRichiami > 0 || nVendite > 0) && (
        <div className="mb-6 space-y-2">
          {nAppOggi > 0 && (
            <Link href="/agenda" className="flex items-center justify-between gap-2 rounded-xl border border-linea bg-white px-4 py-3 text-sm font-medium text-inchiostro transition-colors hover:bg-carta">
              <span>Oggi in agenda: {nAppOggi} appuntament{nAppOggi === 1 ? "o" : "i"}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          {nRichiami > 0 && (
            <Link href="/richiami" className="flex items-center justify-between gap-2 rounded-xl border border-ambra/40 bg-ambra-soft px-4 py-3 text-sm font-medium text-ambra transition-colors hover:border-ambra">
              <span>Richiami da fare: {nRichiami}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          {nVendite > 0 && (
            <Link href="/cassa" className="flex items-center justify-between gap-2 rounded-xl border border-linea bg-white px-4 py-3 text-sm font-medium text-inchiostro transition-colors hover:bg-carta">
              <span>Incasso di oggi: {fmtEuro(incassoOggi)} — {nVendite} vendit{nVendite === 1 ? "a" : "e"}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      )}

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
