import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, ButtonLink, Badge, Vuoto, tintaFonte } from "@/components/ui";
import { AzioniAppuntamento } from "@/components/AzioniAgenda";
import { StrisciaRichieste } from "@/components/StrisciaRichieste";
import { oraDi, oraFine, etichettaTipoApp, PillStatoApp } from "@/components/AgendaUI";
import { ETICHETTE_FONTE, oggiRoma, istanteRomaISO } from "@/lib/utils";

const GG = 24 * 60 * 60 * 1000;
const giornoDopo = (iso: string) =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + GG).toISOString().slice(0, 10);

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const sp = await searchParams;
  const oggi = oggiRoma();
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : oggi;
  const supabase = await createClient();

  // Finestra del giorno in ora italiana: [00:00 Roma, 00:00 Roma del giorno dopo).
  // Ancorare a Europe/Rome (non a mezzanotte UTC) mette ogni appuntamento nel suo
  // giorno anche vicino alla mezzanotte. Vedi lib/utils § fuso / TODO §6.
  const { data: appuntamenti } = await supabase
    .from("appuntamenti")
    .select("id, cliente_id, utente_id, tipo, inizio, durata_minuti, stato, riferimento, fonte")
    .gte("inizio", istanteRomaISO(data, "00:00"))
    .lt("inizio", istanteRomaISO(giornoDopo(data), "00:00"))
    .order("inizio");
  const righe = appuntamenti ?? [];

  // Prenotazioni collegate alle righe del giorno: chi ha prenotato (§3) e se la
  // riga è "prendibile" come cliente (§6). Una lettura in più su appuntamento_id.
  const apptIds = righe.map((a) => a.id);
  const { data: prenDay } = apptIds.length
    ? await supabase
        .from("prenotazioni")
        .select("id, appuntamento_id, contatto_nome, contatto_telefono, per_conto_di, servizio_codice, stato, cliente_id")
        .in("appuntamento_id", apptIds)
    : { data: [] };
  const prenByAppt = new Map((prenDay ?? []).map((p) => [p.appuntamento_id, p]));

  // Le richieste in sospeso DA OGGI IN AVANTI (§2): non solo il giorno aperto.
  const { data: sospesiRaw } = await supabase
    .from("appuntamenti")
    .select("id, inizio")
    .eq("stato", "in_attesa")
    .gte("inizio", istanteRomaISO(oggi, "00:00"))
    .order("inizio");
  const sospesi = sospesiRaw ?? [];
  const sospIds = sospesi.map((s) => s.id);
  const { data: prenSosp } = sospIds.length
    ? await supabase
        .from("prenotazioni")
        .select("appuntamento_id, contatto_nome, servizio_codice")
        .in("appuntamento_id", sospIds)
    : { data: [] };
  const prenSospByAppt = new Map((prenSosp ?? []).map((p) => [p.appuntamento_id, p]));

  // Etichette dei servizi richiesti (catalogo leggibile da ogni autenticato).
  const codici = [
    ...new Set(
      [...(prenDay ?? []), ...(prenSosp ?? [])]
        .map((p) => p.servizio_codice)
        .filter(Boolean) as string[]
    ),
  ];
  const { data: servizi } = codici.length
    ? await supabase.from("servizi").select("codice, nome").in("codice", codici)
    : { data: [] };
  const nomeServizio = new Map((servizi ?? []).map((s) => [s.codice, s.nome]));

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

  const giornoBreve = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${iso.slice(0, 10)}T12:00:00Z`)
    );

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

      {/* §2 · Le richieste in sospeso da oggi in avanti. Se non ce ne sono, niente
          striscia: nessuno spazio vuoto che ricorda che manca qualcosa.
          Il blocco è passato in un componente: le letture qui sopra sono le
          stesse di G8, cambia solo chi disegna la striscia. */}
      <StrisciaRichieste
        richieste={sospesi.map((s) => {
          const pr = prenSospByAppt.get(s.id);
          const giorno = s.inizio.slice(0, 10);
          return {
            id: s.id,
            inizio: s.inizio,
            giorno,
            giornoEtichetta: giornoBreve(giorno),
            servizio: pr?.servizio_codice
              ? nomeServizio.get(pr.servizio_codice) ?? pr.servizio_codice
              : "Richiesta dal portale",
            cliente: pr?.contatto_nome ?? "Senza nome",
            // Il telefono non c'è: la lettura delle sospese non lo porta.
            // È l'unica voce di caso C del ramo — vedi docs/design/dati-mancanti.md §6.
          };
        })}
      />
      {/* fine §2 */}

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
            {righe.map((a) => {
              const pren = prenByAppt.get(a.id);
              const inAttesa = a.stato === "in_attesa";
              const prendibile =
                a.stato === "prenotato" && !!pren && pren.stato === "accettata" && !pren.cliente_id;
              return (
                <div
                  key={a.id}
                  // La riga in attesa resta nella sequenza oraria del giorno, non
                  // raccolta in cima: la posizione nell'orario È l'informazione che
                  // serve per decidere se accettare. Si distingue col filetto verde
                  // a sinistra — lo stesso segno dell'errore, sempre a sinistra,
                  // sempre a dire «guarda qui prima» — e il fondo appena tinto.
                  className={`flex items-start gap-3 py-3.5${
                    inAttesa
                      ? " border-l-[3px] border-l-verde-600 bg-verde-50 pl-[17px] pr-5"
                      : " px-5"
                  }`}
                >
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
                      ) : pren ? (
                        <span className="text-sm font-semibold text-inchiostro">{pren.contatto_nome}</span>
                      ) : (
                        <span className="text-sm font-semibold text-soft">Impegno interno</span>
                      )}
                      {pren && (
                        <Badge tinta={tintaFonte(a.fonte)}>{ETICHETTE_FONTE[a.fonte] ?? a.fonte}</Badge>
                      )}
                      {sovrappone.has(a.id) && (
                        <span title="Si sovrappone" className="inline-block h-2 w-2 rounded-full bg-rosso-500" />
                      )}
                    </div>
                    {/* §3 · chi ha prenotato (per le richieste): telefono, per conto di, servizio. */}
                    {inAttesa && pren ? (
                      <p className="mt-0.5 text-xs text-soft">
                        <span className="f-mono">{pren.contatto_telefono}</span>
                        {pren.per_conto_di ? ` · per ${pren.per_conto_di}` : ""}
                        {pren.servizio_codice && nomeServizio.get(pren.servizio_codice)
                          ? ` · ${nomeServizio.get(pren.servizio_codice)}`
                          : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-faint">
                        {a.utente_id && nomeUtente.get(a.utente_id) ? `con ${nomeUtente.get(a.utente_id)}` : ""}
                        {a.riferimento ? ` · ${a.riferimento}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PillStatoApp stato={a.stato} />
                    <AzioniAppuntamento
                      id={a.id}
                      stato={a.stato}
                      prenotazioneId={pren?.id}
                      prendibile={prendibile}
                    />
                  </div>
                </div>
              );
            })}
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
