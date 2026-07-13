import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, ButtonLink, Badge, Vuoto } from "@/components/ui";
import { AzioniAppuntamento } from "@/components/AzioniAgenda";
import { oraDi, oraFine, etichettaTipoApp, PillStatoApp } from "@/components/AgendaUI";

const GG = 24 * 60 * 60 * 1000;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const sp = await searchParams;
  const oggi = new Date().toISOString().slice(0, 10);
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : oggi;
  const supabase = await createClient();

  const { data: appuntamenti } = await supabase
    .from("appuntamenti")
    .select("id, cliente_id, utente_id, tipo, inizio, durata_minuti, stato, riferimento")
    .gte("inizio", `${data}T00:00:00`)
    .lte("inizio", `${data}T23:59:59`)
    .order("inizio");
  const righe = appuntamenti ?? [];

  const clienteIds = [...new Set(righe.map((a) => a.cliente_id).filter(Boolean))] as string[];
  const utenteIds = [...new Set(righe.map((a) => a.utente_id).filter(Boolean))] as string[];
  const [{ data: clienti }, { data: utenti }] = await Promise.all([
    clienteIds.length ? supabase.from("clienti").select("id, nome, cognome").in("id", clienteIds) : Promise.resolve({ data: [] }),
    utenteIds.length ? supabase.from("utenti").select("id, nome").in("id", utenteIds) : Promise.resolve({ data: [] }),
  ]);
  const nomeCliente = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome]));

  // Sovrapposizioni per stesso operatore (§2.8)
  const sovrappone = new Set<string>();
  for (let i = 0; i < righe.length; i++) {
    for (let j = i + 1; j < righe.length; j++) {
      const a = righe[i], b = righe[j];
      if (!a.utente_id || a.utente_id !== b.utente_id) continue;
      const ai = new Date(a.inizio).getTime(), af = ai + a.durata_minuti * 60000;
      const bi = new Date(b.inizio).getTime(), bf = bi + b.durata_minuti * 60000;
      if (ai < bf && bi < af) { sovrappone.add(a.id); sovrappone.add(b.id); }
    }
  }

  const completati = righe.filter((a) => a.stato === "completato").length;
  const mancati = righe.filter((a) => a.stato === "mancato").length;

  const prec = new Date(new Date(`${data}T12:00:00Z`).getTime() - GG).toISOString().slice(0, 10);
  const succ = new Date(new Date(`${data}T12:00:00Z`).getTime() + GG).toISOString().slice(0, 10);
  const leggibile = new Intl.DateTimeFormat("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${data}T12:00:00Z`));

  return (
    <>
      <PageHeader
        titolo="Agenda"
        sotto={leggibile.charAt(0).toUpperCase() + leggibile.slice(1)}
        azione={
          <ButtonLink href={`/agenda/nuovo?data=${data}`} variante="accent">
            <Plus size={16} /> Nuovo appuntamento
          </ButtonLink>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Link href={`/agenda?data=${prec}`} className="rounded-lg border border-linea bg-white p-2 text-soft hover:bg-carta" aria-label="Giorno precedente">
          <ChevronLeft size={16} />
        </Link>
        <Link href="/agenda" className="rounded-lg border border-linea bg-white px-4 py-2 text-sm font-semibold text-inchiostro hover:bg-carta">
          Oggi
        </Link>
        <Link href={`/agenda?data=${succ}`} className="rounded-lg border border-linea bg-white p-2 text-soft hover:bg-carta" aria-label="Giorno successivo">
          <ChevronRight size={16} />
        </Link>
      </div>

      {righe.length > 0 ? (
        <>
          <Card className="divide-y divide-linea !p-0">
            {righe.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-20 shrink-0">
                  <p className="f-mono text-sm font-semibold text-inchiostro">{oraDi(a.inizio)}</p>
                  <p className="f-mono text-[11px] text-faint">{oraFine(a.inizio, a.durata_minuti)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tinta="neutro">{etichettaTipoApp(a.tipo)}</Badge>
                    {a.cliente_id ? (
                      <Link href={`/clienti/${a.cliente_id}`} className="text-sm font-semibold text-inchiostro hover:underline">
                        {nomeCliente.get(a.cliente_id) ?? "Cliente"}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-soft">Impegno interno</span>
                    )}
                    {sovrappone.has(a.id) && (
                      <span title="Si sovrappone" className="inline-block h-2 w-2 rounded-full bg-ambra" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-faint">
                    {a.utente_id && nomeUtente.get(a.utente_id) ? `con ${nomeUtente.get(a.utente_id)}` : ""}
                    {a.riferimento ? ` · ${a.riferimento}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PillStatoApp stato={a.stato} />
                  {a.stato === "prenotato" && <AzioniAppuntamento id={a.id} />}
                </div>
              </div>
            ))}
          </Card>
          {completati + mancati > 0 && (
            <p className="mt-3 text-xs text-faint">
              {completati} completati · {mancati} non presentati
            </p>
          )}
        </>
      ) : (
        <Vuoto
          titolo="Giornata libera"
          testo="Nessun appuntamento per questo giorno."
          azione={
            <ButtonLink href={`/agenda/nuovo?data=${data}`} variante="ghost">
              <Plus size={16} /> Nuovo appuntamento
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
