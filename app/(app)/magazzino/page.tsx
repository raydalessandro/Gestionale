import Link from "next/link";
import { Search, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader,
  Card,
  ButtonLink,
  Vuoto,
  inputCls,
} from "@/components/ui";
import {
  BadgeTipoProdotto,
  PillFermo,
  QuantitaMovimento,
  etichettaMovimento,
  sottoScorta,
  fermoScaduto,
  parametriMontatura,
} from "@/components/MagazzinoUI";
import { ContatoreCard } from "@/components/OrdiniUI";
import { AzioniFermo } from "@/components/AzioniMagazzino";
import { STATI_FERMO, ETICHETTE_MOVIMENTO, fmtEuro, fmtQuando, fmtData } from "@/lib/utils";

type Vista = "prodotti" | "movimenti" | "fermi";
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const TIPI_MOVIMENTO = Object.keys(ETICHETTE_MOVIMENTO);

export default async function MagazzinoPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; filtro?: string }>;
}) {
  const sp = await searchParams;
  const vista: Vista =
    sp.vista === "movimenti" ? "movimenti" : sp.vista === "fermi" ? "fermi" : "prodotti";
  const q = sp.q?.trim() ?? "";
  const filtro = sp.filtro ?? "";
  const supabase = await createClient();

  const contatori = await caricaContatori(supabase);

  return (
    <>
      <PageHeader
        titolo="Magazzino"
        sotto="Catalogo, giacenze e merce messa da parte."
        azione={
          vista === "prodotti" ? (
            <ButtonLink href="/magazzino/prodotti/nuovo" variante="accent">
              <Plus size={16} /> Nuovo prodotto
            </ButtonLink>
          ) : vista === "fermi" ? (
            <ButtonLink href="/magazzino?vista=prodotti" variante="accent">
              <Plus size={16} /> Nuovo fermo
            </ButtonLink>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl border border-linea bg-carta p-1">
        {(["prodotti", "movimenti", "fermi"] as const).map((v) => (
          <Link
            key={v}
            href={`/magazzino?vista=${v}`}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold capitalize transition-colors ${
              vista === v ? "bg-inchiostro text-carta" : "text-soft hover:text-inchiostro"
            }`}
          >
            {v}
          </Link>
        ))}
      </div>

      {/* Contatori */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <ContatoreCard valore={contatori.attivi} label="Prodotti attivi" />
        <Link href="/magazzino?vista=prodotti&filtro=sotto_scorta" className="block">
          <div className="rounded-2xl border border-linea bg-white p-4 shadow-[0_1px_2px_rgba(28,23,20,0.04)] transition-colors hover:border-faint">
            <p className={`f-mono text-2xl font-semibold tabular-nums ${contatori.sottoScorta > 0 ? "text-rosso" : "text-inchiostro"}`}>
              {contatori.sottoScorta}
            </p>
            <p className="mt-1 text-xs font-medium text-soft">Sotto scorta</p>
          </div>
        </Link>
        <ContatoreCard
          valore={contatori.fermiAttivi}
          label="Fermi attivi"
          nota={contatori.fermiScaduti > 0 ? `${contatori.fermiScaduti} scaduti` : undefined}
        />
      </div>

      {vista === "prodotti" && <VistaProdotti supabase={supabase} q={q} filtro={filtro} />}
      {vista === "movimenti" && <VistaMovimenti supabase={supabase} filtro={filtro} />}
      {vista === "fermi" && <VistaFermi supabase={supabase} filtro={filtro} />}
    </>
  );
}

/* ── Contatori ─────────────────────────────────────────────────────── */

async function caricaContatori(supabase: SupabaseServer) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [attivi, perScorta, fermiAttivi, fermiScaduti] = await Promise.all([
    supabase.from("prodotti").select("*", { count: "exact", head: true }).eq("attivo", true),
    supabase.from("prodotti").select("giacenza, scorta_minima").eq("attivo", true).gt("scorta_minima", 0),
    supabase.from("fermi").select("*", { count: "exact", head: true }).eq("stato", "attivo"),
    supabase.from("fermi").select("*", { count: "exact", head: true }).eq("stato", "attivo").lt("scade_il", oggi),
  ]);
  const sotto = (perScorta.data ?? []).filter((p) => p.giacenza <= p.scorta_minima).length;
  return {
    attivi: attivi.count ?? 0,
    sottoScorta: sotto,
    fermiAttivi: fermiAttivi.count ?? 0,
    fermiScaduti: fermiScaduti.count ?? 0,
  };
}

/* ── Vista prodotti ────────────────────────────────────────────────── */

async function VistaProdotti({
  supabase,
  q,
  filtro,
}: {
  supabase: SupabaseServer;
  q: string;
  filtro: string;
}) {
  let query = supabase
    .from("prodotti")
    .select("id, tipo, marca, nome, sku, prezzo, giacenza, scorta_minima, attivo, parametri")
    .order("nome")
    .limit(100);

  if (filtro === "disattivati") query = query.eq("attivo", false);
  else query = query.eq("attivo", true);

  if (q) {
    const t = q.replace(/[%,]/g, "");
    query = query.or(`nome.ilike.%${t}%,marca.ilike.%${t}%,sku.ilike.%${t}%`);
  }

  let { data: prodotti } = await query;
  prodotti = prodotti ?? [];
  if (filtro === "sotto_scorta") prodotti = prodotti.filter((p) => sottoScorta(p));

  // Impegnati (fermi attivi) per i prodotti mostrati
  const ids = prodotti.map((p) => p.id);
  const { data: fermi } = ids.length
    ? await supabase.from("fermi").select("prodotto_id, quantita").eq("stato", "attivo").in("prodotto_id", ids)
    : { data: [] };
  const impegnato = new Map<string, number>();
  for (const f of fermi ?? []) impegnato.set(f.prodotto_id, (impegnato.get(f.prodotto_id) ?? 0) + f.quantita);

  const chip = (id: string, label: string) => (
    <Link
      key={id}
      href={`/magazzino?vista=prodotti${id ? `&filtro=${id}` : ""}`}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        filtro === id || (!filtro && id === "")
          ? "border-inchiostro bg-inchiostro text-carta"
          : "border-linea bg-white text-soft hover:border-faint hover:text-inchiostro"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <form className="relative mb-3" action="/magazzino" method="get">
        <input type="hidden" name="vista" value="prodotti" />
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input type="search" name="q" defaultValue={q} placeholder="Cerca per nome, marca o SKU…" className={`${inputCls} !pl-10`} />
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip("", "Tutti")}
        {chip("sotto_scorta", "Sotto scorta")}
        {chip("disattivati", "Disattivati")}
      </div>

      {prodotti.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {prodotti.map((p) => {
            const scorta = sottoScorta(p);
            const imp = impegnato.get(p.id) ?? 0;
            const calibro =
              p.tipo === "montatura" || p.tipo === "sole"
                ? parametriMontatura(p.parametri).calibro
                : null;
            return (
              <Link key={p.id} href={`/magazzino/prodotti/${p.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-carta">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-semibold text-inchiostro">
                      {[p.marca, p.nome].filter(Boolean).join(" ")}
                    </span>
                    {calibro != null && (
                      <span className="f-mono text-xs text-soft">◻ {calibro}</span>
                    )}
                    <BadgeTipoProdotto tipo={p.tipo} />
                  </div>
                  <p className="mt-0.5 text-xs text-soft">
                    {p.sku ? <span className="f-mono">{p.sku}</span> : "senza SKU"} · {fmtEuro(p.prezzo)}
                    {imp > 0 ? ` · ${imp} impegnati` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`f-mono text-lg font-semibold tabular-nums ${!p.attivo ? "text-faint" : scorta ? "text-rosso" : "text-inchiostro"}`}>
                    {p.giacenza}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-faint">giacenza</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <Vuoto
          titolo={q || filtro ? "Nessun prodotto" : "Catalogo vuoto"}
          testo={q || filtro ? "Cambia ricerca o filtro." : "Aggiungi il primo prodotto al catalogo."}
          azione={
            <ButtonLink href="/magazzino/prodotti/nuovo" variante="ghost">
              <Plus size={16} /> Nuovo prodotto
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

/* ── Vista movimenti ───────────────────────────────────────────────── */

async function VistaMovimenti({ supabase, filtro }: { supabase: SupabaseServer; filtro: string }) {
  let query = supabase
    .from("movimenti_magazzino")
    .select("id, prodotto_id, tipo, quantita, riferimento, utente_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filtro && TIPI_MOVIMENTO.includes(filtro)) query = query.eq("tipo", filtro as never);

  const { data: movimenti } = await query;
  const rows = movimenti ?? [];

  const prodIds = [...new Set(rows.map((m) => m.prodotto_id))];
  const utenteIds = [...new Set(rows.map((m) => m.utente_id).filter(Boolean))] as string[];
  const [{ data: prodotti }, { data: utenti }] = await Promise.all([
    prodIds.length ? supabase.from("prodotti").select("id, nome, marca").in("id", prodIds) : Promise.resolve({ data: [] }),
    utenteIds.length ? supabase.from("utenti").select("id, nome").in("id", utenteIds) : Promise.resolve({ data: [] }),
  ]);
  const nomeProd = new Map((prodotti ?? []).map((p) => [p.id, [p.marca, p.nome].filter(Boolean).join(" ")]));
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome]));

  const chip = (id: string, label: string) => (
    <Link
      key={id || "tutti"}
      href={`/magazzino?vista=movimenti${id ? `&filtro=${id}` : ""}`}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        filtro === id || (!filtro && !id)
          ? "border-inchiostro bg-inchiostro text-carta"
          : "border-linea bg-white text-soft hover:border-faint hover:text-inchiostro"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip("", "Tutti")}
        {TIPI_MOVIMENTO.map((t) => chip(t, ETICHETTE_MOVIMENTO[t]))}
      </div>

      {rows.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/magazzino/prodotti/${m.prodotto_id}`} className="text-sm font-semibold text-inchiostro hover:underline">
                  {nomeProd.get(m.prodotto_id) ?? "Prodotto"}
                </Link>
                <p className="truncate text-[11px] text-faint">
                  {etichettaMovimento(m.tipo)} · {fmtQuando(m.created_at)}
                  {m.riferimento ? ` · ${m.riferimento}` : ""}
                  {m.utente_id && nomeUtente.get(m.utente_id) ? ` · ${nomeUtente.get(m.utente_id)}` : ""}
                </p>
              </div>
              <QuantitaMovimento quantita={m.quantita} />
            </div>
          ))}
        </Card>
      ) : (
        <Vuoto titolo="Nessun movimento" testo="I movimenti di carico e scarico compariranno qui." />
      )}
    </>
  );
}

/* ── Vista fermi ───────────────────────────────────────────────────── */

async function VistaFermi({ supabase, filtro }: { supabase: SupabaseServer; filtro: string }) {
  let query = supabase
    .from("fermi")
    .select("id, prodotto_id, cliente_id, quantita, stato, scade_il, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filtro) query = query.eq("stato", filtro as never);

  const { data: fermi } = await query;
  const rows = fermi ?? [];

  const prodIds = [...new Set(rows.map((f) => f.prodotto_id))];
  const cliIds = [...new Set(rows.map((f) => f.cliente_id))];
  const [{ data: prodotti }, { data: clienti }] = await Promise.all([
    prodIds.length ? supabase.from("prodotti").select("id, nome, marca").in("id", prodIds) : Promise.resolve({ data: [] }),
    cliIds.length ? supabase.from("clienti").select("id, nome, cognome").in("id", cliIds) : Promise.resolve({ data: [] }),
  ]);
  const nomeProd = new Map((prodotti ?? []).map((p) => [p.id, [p.marca, p.nome].filter(Boolean).join(" ")]));
  const nomeCliente = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));

  const chip = (id: string, label: string) => (
    <Link
      key={id || "tutti"}
      href={`/magazzino?vista=fermi${id ? `&filtro=${id}` : ""}`}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        filtro === id || (!filtro && !id)
          ? "border-inchiostro bg-inchiostro text-carta"
          : "border-linea bg-white text-soft hover:border-faint hover:text-inchiostro"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chip("", "Tutti")}
        {STATI_FERMO.map((s) => chip(s.id, s.label))}
      </div>

      {rows.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {rows.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={`/magazzino/prodotti/${f.prodotto_id}`} className="text-sm font-semibold text-inchiostro hover:underline">
                  {nomeProd.get(f.prodotto_id) ?? "Prodotto"}
                </Link>
                <p className="text-xs text-soft">
                  <Link href={`/clienti/${f.cliente_id}`} className="hover:underline">
                    {nomeCliente.get(f.cliente_id) ?? "Cliente"}
                  </Link>{" "}
                  · {f.quantita} pz ·{" "}
                  {f.scade_il ? (
                    <span className={fermoScaduto(f) ? "font-semibold text-rosso" : ""}>scade {fmtData(f.scade_il)}</span>
                  ) : (
                    "senza scadenza"
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <PillFermo stato={f.stato} />
                {f.stato === "attivo" && <AzioniFermo id={f.id} />}
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Vuoto titolo="Nessun fermo" testo="Metti da parte un articolo dalla sua scheda prodotto." />
      )}
    </>
  );
}
