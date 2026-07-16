import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Vuoto } from "@/components/ui";
import { normalizzaTelefono, waLink } from "@/components/OrdiniUI";
import { etichettaTipoRichiamo } from "@/components/AgendaUI";
import {
  RegistraEsito,
  EsitoProposta,
  PianificaProposta,
  NuovoRichiamo,
  Ripianifica,
} from "@/components/AzioniRichiami";
import { calcolaProposte } from "@/lib/richiami-proposte";
import { fmtEuro, fmtQuando, fmtData, ESITI_RICHIAMO, CANALI_RICHIAMO, canaleEsitoDaPreferito } from "@/lib/utils";

const GG = 24 * 60 * 60 * 1000;

function messaggioRichiamo(tipo: string, nome: string, azienda: string): string {
  const firma = ` — ${azienda}`;
  switch (tipo) {
    case "ritiro_sollecito":
      return `Ciao ${nome}! Il tuo ordine è pronto in negozio, ti aspettiamo per il ritiro.${firma}`;
    case "promessa_ritardo":
      return `Ciao ${nome}! Un aggiornamento sul tuo ordine: ci vuole ancora un po', ti teniamo aggiornato.${firma}`;
    case "lac_esaurimento":
      return `Ciao ${nome}! Le tue lenti a contatto potrebbero essere in esaurimento: vuoi che prepariamo una nuova fornitura?${firma}`;
    case "controllo_vista":
      return `Ciao ${nome}! È passato un po' dall'ultimo controllo della vista: ti va di fissare un appuntamento?${firma}`;
    case "fermo_scadenza":
      return `Ciao ${nome}! Hai un articolo messo da parte da noi in scadenza: quando passi a ritirarlo?${firma}`;
    default:
      return `Ciao ${nome}! Ti contattiamo dal negozio.${firma}`;
  }
}

function Contatti({ telefono, messaggio }: { telefono: string | null; messaggio: string }) {
  if (!telefono) return null;
  return (
    <div className="flex gap-1.5">
      <a href={`tel:${normalizzaTelefono(telefono)}`} className="inline-flex items-center gap-1 rounded-lg border border-linea bg-white px-2.5 py-1 text-xs font-semibold text-inchiostro hover:bg-carta">
        <Phone size={12} /> Chiama
      </a>
      <a href={waLink(telefono, messaggio)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-linea bg-white px-2.5 py-1 text-xs font-semibold text-inchiostro hover:bg-carta">
        <MessageCircle size={12} /> WhatsApp
      </a>
    </div>
  );
}

export default async function RichiamiPage() {
  const supabase = await createClient();
  const oggi = new Date().toISOString().slice(0, 10);
  const traSette = new Date(Date.now() + 7 * GG).toISOString().slice(0, 10);

  const [{ data: daFare }, { data: storico }, { data: azienda }, risultato] = await Promise.all([
    supabase
      .from("richiami")
      .select("id, cliente_id, tipo, da_fare_il, riferimento, valore")
      .is("esito", null)
      .lte("da_fare_il", traSette)
      .order("da_fare_il"),
    supabase
      .from("richiami")
      .select("id, cliente_id, tipo, canale, esito, valore, fatto_il, utente_id, riferimento")
      .not("esito", "is", null)
      .order("fatto_il", { ascending: false })
      .limit(50),
    supabase.from("aziende").select("nome").limit(1).maybeSingle(),
    calcolaProposte(supabase),
  ]);

  const aziendaNome = azienda?.nome ?? "";
  const daFareRows = daFare ?? [];
  const storicoRows = storico ?? [];

  // Info cliente per da-fare e storico
  const cliIds = [
    ...new Set([...daFareRows, ...storicoRows].map((r) => r.cliente_id).filter(Boolean)),
  ] as string[];
  const utenteIds = [...new Set(storicoRows.map((r) => r.utente_id).filter(Boolean))] as string[];
  const [{ data: clienti }, { data: utenti }] = await Promise.all([
    cliIds.length ? supabase.from("clienti").select("id, nome, cognome, telefono, canale_preferito, non_contattare").in("id", cliIds) : Promise.resolve({ data: [] }),
    utenteIds.length ? supabase.from("utenti").select("id, nome").in("id", utenteIds) : Promise.resolve({ data: [] }),
  ]);
  const info = new Map((clienti ?? []).map((c) => [c.id, c]));
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome]));

  const due = daFareRows.filter((r) => r.da_fare_il <= oggi);
  const inArrivo = daFareRows.filter((r) => r.da_fare_il > oggi);
  const proposte = risultato.proposte;

  return (
    <>
      <PageHeader
        titolo="Richiami"
        sotto="La coda che porta i clienti in negozio."
        azione={<NuovoRichiamo />}
      />

      {/* 1 · Da fare */}
      <h2 className="f-serif mb-2 text-lg font-semibold text-inchiostro">Da fare</h2>
      {due.length > 0 || inArrivo.length > 0 ? (
        <Card className="mb-6 divide-y divide-linea !p-0">
          {due.map((r) => {
            const c = r.cliente_id ? info.get(r.cliente_id) : null;
            const nome = c?.nome ?? "";
            const scad = Math.floor((Date.now() - new Date(r.da_fare_il).getTime()) / GG);
            return (
              <div key={r.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tinta="ottone">{etichettaTipoRichiamo(r.tipo)}</Badge>
                      {c && r.cliente_id && (
                        <Link href={`/clienti/${r.cliente_id}`} className="text-sm font-semibold text-inchiostro hover:underline">
                          {c.cognome} {c.nome}
                        </Link>
                      )}
                      {scad > 0 && <span className="text-[11px] font-semibold text-rosso">scaduto da {scad} gg</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-faint">
                      {r.riferimento ? <span className="f-mono">{r.riferimento}</span> : ""}
                      {r.valore != null ? ` · ${fmtEuro(r.valore)}` : ""}
                      {c?.telefono ? ` · ${c.telefono}` : ""}
                    </p>
                  </div>
                  <Contatti telefono={c?.telefono ?? null} messaggio={messaggioRichiamo(r.tipo, nome, aziendaNome)} />
                </div>
                <div className="mt-2">
                  <RegistraEsito id={r.id} valore={r.valore} canale={canaleEsitoDaPreferito(c?.canale_preferito)} />
                </div>
              </div>
            );
          })}
          {inArrivo.length > 0 && (
            <div className="bg-carta/50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
              In arrivo (entro 7 giorni)
            </div>
          )}
          {inArrivo.map((r) => {
            const c = r.cliente_id ? info.get(r.cliente_id) : null;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tinta="ottone">{etichettaTipoRichiamo(r.tipo)}</Badge>
                    {c && r.cliente_id && (
                      <Link href={`/clienti/${r.cliente_id}`} className="text-sm font-semibold text-inchiostro hover:underline">{c.cognome} {c.nome}</Link>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-faint">da fare il {fmtData(r.da_fare_il)}{r.valore != null ? ` · ${fmtEuro(r.valore)}` : ""}</p>
                </div>
                <RegistraEsito id={r.id} valore={r.valore} canale={canaleEsitoDaPreferito(c?.canale_preferito)} />
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="mb-6"><p className="text-sm text-faint">Niente da richiamare oggi. Buon lavoro.</p></Card>
      )}

      {/* 2 · Proposte */}
      <h2 className="f-serif mb-2 text-lg font-semibold text-inchiostro">Proposte dal negozio</h2>
      {risultato.nascosteCommerciali > 0 && (
        <p className="mb-2 rounded-xl border border-linea bg-carta px-4 py-2 text-xs text-soft">
          {risultato.nascosteCommerciali} proposte commerciali nascoste per mancanza di consenso marketing.
        </p>
      )}
      {proposte.length > 0 ? (
        <Card className="mb-6 divide-y divide-linea !p-0">
          {proposte.map((p, i) => (
            <div key={i} className="px-5 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tinta="ottone">{etichettaTipoRichiamo(p.tipo)}</Badge>
                    <Link href={`/clienti/${p.cliente_id}`} className="text-sm font-semibold text-inchiostro hover:underline">{p.clienteNome}</Link>
                    {p.nonContattare && <Badge tinta="neutro">Non contattare</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-soft">{p.motivo}</p>
                  <p className="text-[11px] text-faint">
                    {p.riferimento ? <span className="f-mono">{p.riferimento}</span> : ""}
                    {p.valore != null ? ` · ${fmtEuro(p.valore)}` : ""}
                    {p.telefono ? ` · ${p.telefono}` : ""}
                  </p>
                </div>
                <Contatti telefono={p.telefono} messaggio={messaggioRichiamo(p.tipo, p.clienteNome.split(" ").slice(-1)[0], aziendaNome)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <EsitoProposta proposta={{ tipo: p.tipo, cliente_id: p.cliente_id, riferimento: p.riferimento, valore: p.valore }} canale={canaleEsitoDaPreferito(p.canalePreferito)} />
                <PianificaProposta proposta={{ tipo: p.tipo, cliente_id: p.cliente_id, riferimento: p.riferimento, valore: p.valore }} />
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="mb-6"><p className="text-sm text-faint">Nessuna proposta dal negozio in questo momento.</p></Card>
      )}

      {/* 3 · Storico */}
      <h2 className="f-serif mb-2 text-lg font-semibold text-inchiostro">Storico</h2>
      {storicoRows.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {storicoRows.map((r) => {
            const c = r.cliente_id ? info.get(r.cliente_id) : null;
            return (
              <div key={r.id} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-inchiostro">{etichettaTipoRichiamo(r.tipo)}</span>
                    {c && <span className="text-soft"> · {c.cognome} {c.nome}</span>}
                    <p className="text-[11px] text-faint">
                      {r.fatto_il ? fmtQuando(r.fatto_il) : ""}
                      {r.canale ? ` · ${CANALI_RICHIAMO[r.canale] ?? r.canale}` : ""}
                      {r.esito ? ` · ${ESITI_RICHIAMO[r.esito] ?? r.esito}` : ""}
                      {r.utente_id && nomeUtente.get(r.utente_id) ? ` · ${nomeUtente.get(r.utente_id)}` : ""}
                    </p>
                  </div>
                  {r.valore != null && <span className="f-mono text-xs tabular-nums text-soft">{fmtEuro(r.valore)}</span>}
                </div>
                {r.esito === "richiamare" && r.cliente_id && (
                  <div className="mt-1.5">
                    <Ripianifica proposta={{ tipo: r.tipo, cliente_id: r.cliente_id, riferimento: r.riferimento, valore: r.valore }} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ) : (
        <Vuoto titolo="Storico vuoto" testo="Qui finiscono i richiami lavorati." />
      )}
    </>
  );
}
