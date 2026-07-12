import Link from "next/link";
import { Search, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader,
  Card,
  ButtonLink,
  Badge,
  tintaFonte,
  Vuoto,
  inputCls,
} from "@/components/ui";
import {
  PillStato,
  ContatoreCard,
  descrizioneLac,
  descrizioneBusta,
  STATI_FINALI_BUSTA,
} from "@/components/OrdiniUI";
import {
  STATI_LAC,
  STATI_BUSTA,
  ETICHETTE_FONTE,
  fmtQuando,
  fmtData,
} from "@/lib/utils";

type Vista = "lac" | "buste";
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Riga normalizzata per la lista, comune a LAC e buste. */
type RigaLista = {
  id: string;
  numero: string;
  cliente_id: string | null;
  stato: string;
  fonte: string;
  updated_at: string;
  descrizione: string;
  data_promessa: string | null;
};

const SETTE_GIORNI = 7 * 24 * 60 * 60 * 1000;

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; stato?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const vista: Vista = sp.vista === "buste" ? "buste" : "lac";
  const stato = sp.stato ?? "";
  const q = sp.q?.trim() ?? "";
  const supabase = await createClient();

  const stati = vista === "lac" ? STATI_LAC : STATI_BUSTA;

  const link = (patch: { stato?: string | null; q?: string | null }) => {
    const p = new URLSearchParams();
    p.set("vista", vista);
    const st = patch.stato !== undefined ? patch.stato : stato;
    const qq = patch.q !== undefined ? patch.q : q;
    if (st) p.set("stato", st);
    if (qq) p.set("q", qq);
    return `/ordini?${p.toString()}`;
  };

  // Ricerca per cliente: risolvo prima gli id (se q non è un numero ordine).
  let clienteIdsMatch: string[] | null = null;
  if (q && !/^(bl|ol)/i.test(q)) {
    const term = q.replace(/[%,]/g, "");
    const { data } = await supabase
      .from("clienti")
      .select("id")
      .or(`nome.ilike.%${term}%,cognome.ilike.%${term}%`);
    clienteIdsMatch = (data ?? []).map((c) => c.id);
  }

  const ordini =
    vista === "lac"
      ? await caricaLac(supabase, stato, q, clienteIdsMatch)
      : await caricaBuste(supabase, stato, q, clienteIdsMatch);

  const clienteIds = [...new Set(ordini.map((o) => o.cliente_id).filter(Boolean))] as string[];
  const { data: clientiData } = clienteIds.length
    ? await supabase.from("clienti").select("id, nome, cognome").in("id", clienteIds)
    : { data: [] };
  const nomeCliente = new Map(
    (clientiData ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`])
  );

  const contatori = await caricaContatori(supabase, vista);
  const oggi = Date.now();

  return (
    <>
      <PageHeader
        titolo="Ordini & Buste"
        sotto="La pipeline del banco: dalla richiesta alla consegna."
        azione={
          vista === "lac" ? (
            <ButtonLink href="/ordini/lac/nuovo" variante="accent">
              <Plus size={16} /> Nuovo ordine LAC
            </ButtonLink>
          ) : (
            <ButtonLink href="/ordini/buste/nuova" variante="accent">
              <Plus size={16} /> Nuova busta
            </ButtonLink>
          )
        }
      />

      <div className="mb-4 flex rounded-xl border border-linea bg-carta p-1">
        {(["lac", "buste"] as const).map((v) => (
          <Link
            key={v}
            href={`/ordini?vista=${v}`}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors ${
              vista === v ? "bg-inchiostro text-carta" : "text-soft hover:text-inchiostro"
            }`}
          >
            {v === "lac" ? "Lenti a contatto" : "Buste lavoro"}
          </Link>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {contatori.map((c) => (
          <ContatoreCard key={c.label} valore={c.valore} label={c.label} nota={c.nota} />
        ))}
      </div>

      <form className="relative mb-3" action="/ordini" method="get">
        <input type="hidden" name="vista" value={vista} />
        {stato && <input type="hidden" name="stato" value={stato} />}
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={`Cerca per numero (${vista === "lac" ? "OL-…" : "BL-…"}) o cliente…`}
          className={`${inputCls} !pl-10`}
        />
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <ChipStato href={link({ stato: null })} attiva={!stato} label="Tutti" />
        {stati.map((s) => (
          <ChipStato
            key={s.id}
            href={link({ stato: s.id })}
            attiva={stato === s.id}
            label={s.label}
            colore={{ bg: s.bg, fg: s.fg }}
          />
        ))}
      </div>

      {ordini.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {ordini.map((o) => {
            const promessaScaduta =
              vista === "buste" &&
              o.data_promessa != null &&
              new Date(o.data_promessa).getTime() < oggi &&
              !STATI_FINALI_BUSTA.includes(o.stato);
            return (
              <Link
                key={o.id}
                href={`/ordini/${vista}/${o.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-carta"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="f-mono text-sm font-semibold text-inchiostro">
                      {o.numero}
                    </span>
                    <span className="truncate text-sm text-inchiostro">
                      {(o.cliente_id && nomeCliente.get(o.cliente_id)) || "Cliente rimosso"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-soft">{o.descrizione}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Badge tinta={tintaFonte(o.fonte)}>
                      {ETICHETTE_FONTE[o.fonte] ?? o.fonte}
                    </Badge>
                    <PillStato stato={o.stato} tipo={vista === "lac" ? "lac" : "busta"} />
                  </div>
                  <span className="text-[11px] text-faint">
                    {promessaScaduta ? (
                      <span className="font-semibold text-rosso">
                        promessa {fmtData(o.data_promessa)}
                      </span>
                    ) : (
                      fmtQuando(o.updated_at)
                    )}
                  </span>
                </div>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <Vuoto
          titolo={q || stato ? "Nessun ordine trovato" : "Ancora nessun ordine"}
          testo={
            q || stato
              ? "Cambia filtro o ricerca per vedere altri ordini."
              : vista === "lac"
                ? "Crea il primo ordine di lenti a contatto dal banco."
                : "Apri la prima busta lavoro: dalla Rx alla consegna."
          }
          azione={
            <ButtonLink
              href={vista === "lac" ? "/ordini/lac/nuovo" : "/ordini/buste/nuova"}
              variante="ghost"
            >
              <Plus size={16} /> {vista === "lac" ? "Nuovo ordine LAC" : "Nuova busta"}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

const NESSUN_ID = "00000000-0000-0000-0000-000000000000";

async function caricaLac(
  supabase: SupabaseServer,
  stato: string,
  q: string,
  clienteIds: string[] | null
): Promise<RigaLista[]> {
  let query = supabase
    .from("ordini_lac")
    .select("id, numero, cliente_id, stato, fonte, righe, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (stato) query = query.eq("stato", stato as never);
  if (q && /^(bl|ol)/i.test(q)) query = query.ilike("numero", `%${q.replace(/[%,]/g, "")}%`);
  else if (clienteIds) query = query.in("cliente_id", clienteIds.length ? clienteIds : [NESSUN_ID]);

  const { data } = await query;
  return (data ?? []).map((o) => ({
    id: o.id,
    numero: o.numero,
    cliente_id: o.cliente_id,
    stato: o.stato,
    fonte: o.fonte,
    updated_at: o.updated_at,
    descrizione: descrizioneLac(o.righe),
    data_promessa: null,
  }));
}

async function caricaBuste(
  supabase: SupabaseServer,
  stato: string,
  q: string,
  clienteIds: string[] | null
): Promise<RigaLista[]> {
  let query = supabase
    .from("ordini_occhiali")
    .select(
      "id, numero, cliente_id, stato, fonte, tipo_lavoro, lente_tipo, lente_indice, data_promessa, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (stato) query = query.eq("stato", stato as never);
  if (q && /^(bl|ol)/i.test(q)) query = query.ilike("numero", `%${q.replace(/[%,]/g, "")}%`);
  else if (clienteIds) query = query.in("cliente_id", clienteIds.length ? clienteIds : [NESSUN_ID]);

  const { data } = await query;
  return (data ?? []).map((o) => ({
    id: o.id,
    numero: o.numero,
    cliente_id: o.cliente_id,
    stato: o.stato,
    fonte: o.fonte,
    updated_at: o.updated_at,
    descrizione: descrizioneBusta(o),
    data_promessa: o.data_promessa,
  }));
}

function ChipStato({
  href,
  attiva,
  label,
  colore,
}: {
  href: string;
  attiva: boolean;
  label: string;
  colore?: { bg: string; fg: string };
}) {
  if (attiva && colore) {
    return (
      <Link
        href={href}
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: colore.bg, color: colore.fg }}
      >
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        attiva
          ? "border-inchiostro bg-inchiostro text-carta"
          : "border-linea bg-white text-soft hover:border-faint hover:text-inchiostro"
      }`}
    >
      {label}
    </Link>
  );
}

async function caricaContatori(
  supabase: SupabaseServer,
  vista: Vista
): Promise<{ valore: number; label: string; nota?: string }[]> {
  if (vista === "lac") {
    const [daOrdinare, ordinati, daAvvisare] = await Promise.all([
      supabase.from("ordini_lac").select("*", { count: "exact", head: true }).eq("stato", "da_ordinare"),
      supabase.from("ordini_lac").select("*", { count: "exact", head: true }).eq("stato", "ordinato"),
      supabase
        .from("ordini_lac")
        .select("*", { count: "exact", head: true })
        .eq("stato", "arrivato")
        .is("avvisato_il", null),
    ]);
    return [
      { valore: daOrdinare.count ?? 0, label: "Da ordinare" },
      { valore: ordinati.count ?? 0, label: "Ordinati" },
      { valore: daAvvisare.count ?? 0, label: "Arrivati da avvisare" },
    ];
  }

  const settimanaFa = new Date(Date.now() - SETTE_GIORNI).toISOString();
  const [lavorazione, daIspezionare, pronte, giacenzaVecchia] = await Promise.all([
    supabase.from("ordini_occhiali").select("*", { count: "exact", head: true }).eq("stato", "lavorazione"),
    supabase.from("ordini_occhiali").select("*", { count: "exact", head: true }).eq("stato", "arrivata"),
    supabase.from("ordini_occhiali").select("*", { count: "exact", head: true }).eq("stato", "pronta"),
    supabase
      .from("ordini_occhiali")
      .select("*", { count: "exact", head: true })
      .eq("stato", "pronta")
      .lt("updated_at", settimanaFa),
  ]);
  return [
    { valore: lavorazione.count ?? 0, label: "In lavorazione" },
    { valore: daIspezionare.count ?? 0, label: "Da ispezionare" },
    {
      valore: pronte.count ?? 0,
      label: "Pronte in giacenza",
      nota: (giacenzaVecchia.count ?? 0) > 0 ? `${giacenzaVecchia.count} da oltre 7 gg` : undefined,
    },
  ];
}
