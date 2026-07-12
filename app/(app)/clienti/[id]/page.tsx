import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Phone, Mail, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  PageHeader,
  ButtonLink,
  Badge,
  tintaFonte,
  Vuoto,
} from "@/components/ui";
import PrescrizioneCard from "@/components/PrescrizioneCard";
import { PillStato } from "@/components/OrdiniUI";
import { fmtData, ETICHETTE_FONTE } from "@/lib/utils";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: prescrizioni }, { data: lac }, { data: buste }] =
    await Promise.all([
      supabase.from("clienti").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("prescrizioni")
        .select("*")
        .eq("cliente_id", id)
        .order("data_visita", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("ordini_lac")
        .select("id, numero, stato, created_at")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("ordini_occhiali")
        .select("id, numero, stato, created_at")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (!cliente) notFound();

  const ordini = [
    ...(lac ?? []).map((o) => ({ ...o, tipo: "lac" as const })),
    ...(buste ?? []).map((o) => ({ ...o, tipo: "buste" as const })),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5);

  const contatti = [
    cliente.telefono && { icona: Phone, testo: cliente.telefono },
    cliente.email && { icona: Mail, testo: cliente.email },
    (cliente.citta || cliente.indirizzo) && {
      icona: MapPin,
      testo: [cliente.indirizzo, cliente.cap, cliente.citta, cliente.provincia]
        .filter(Boolean)
        .join(", "),
    },
  ].filter(Boolean) as { icona: typeof Phone; testo: string }[];

  return (
    <>
      <PageHeader
        titolo={`${cliente.cognome} ${cliente.nome}`}
        sotto={`Cliente dal ${fmtData(cliente.created_at)}`}
        azione={
          <div className="flex gap-2">
            <ButtonLink href={`/clienti/${cliente.id}/modifica`} variante="ghost">
              <Pencil size={15} /> Modifica
            </ButtonLink>
            <ButtonLink
              href={`/clienti/${cliente.id}/prescrizioni/nuova`}
              variante="accent"
            >
              <Plus size={16} /> Nuova prescrizione
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tinta={tintaFonte(cliente.fonte)}>
              {ETICHETTE_FONTE[cliente.fonte] ?? cliente.fonte}
            </Badge>
            {cliente.consenso_marketing ? (
              <Badge tinta="verde">Consenso marketing ✓</Badge>
            ) : (
              <Badge tinta="neutro">No consenso marketing</Badge>
            )}
            {cliente.data_nascita && (
              <Badge tinta="neutro">Nato/a {fmtData(cliente.data_nascita)}</Badge>
            )}
          </div>

          {contatti.length > 0 ? (
            <ul className="space-y-2">
              {contatti.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-inchiostro">
                  <c.icona size={15} className="shrink-0 text-ottone" />
                  {c.testo}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">
              Nessun contatto salvato — aggiungilo per abilitare i richiami.
            </p>
          )}

          {cliente.codice_fiscale && (
            <p className="f-mono mt-3 text-xs uppercase tracking-wide text-soft">
              CF {cliente.codice_fiscale}
            </p>
          )}
        </Card>

        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">
            Note
          </p>
          <p className="whitespace-pre-wrap text-sm text-soft">
            {cliente.note || "—"}
          </p>
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="f-serif text-lg font-semibold text-inchiostro">
          Prescrizioni
        </h2>
        <span className="text-xs text-faint">
          {prescrizioni?.length ?? 0} in archivio
        </span>
      </div>

      {prescrizioni && prescrizioni.length > 0 ? (
        <div className="space-y-3">
          {prescrizioni.map((p) => (
            <PrescrizioneCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Vuoto
          titolo="Nessuna prescrizione"
          testo="Registra la prima rilevazione: occhiali o LAC, con lo storico che cresce a ogni visita."
          azione={
            <Link
              href={`/clienti/${cliente.id}/prescrizioni/nuova`}
              className="inline-flex items-center gap-2 rounded-xl border border-linea bg-white px-4 py-2.5 text-sm font-semibold text-inchiostro transition-colors hover:border-faint hover:bg-carta"
            >
              <Plus size={16} /> Nuova prescrizione
            </Link>
          }
        />
      )}

      <div className="mb-3 mt-8 flex items-center justify-between gap-2">
        <h2 className="f-serif text-lg font-semibold text-inchiostro">Ordini</h2>
        <div className="flex gap-2">
          <ButtonLink href={`/ordini/buste/nuova?cliente=${cliente.id}`} variante="ghost">
            <Plus size={15} /> Nuova busta
          </ButtonLink>
          <ButtonLink href={`/ordini/lac/nuovo?cliente=${cliente.id}`} variante="ghost">
            <Plus size={15} /> Nuovo ordine LAC
          </ButtonLink>
        </div>
      </div>

      {ordini.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {ordini.map((o) => (
            <Link
              key={`${o.tipo}-${o.id}`}
              href={`/ordini/${o.tipo}/${o.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-carta"
            >
              <div className="flex items-center gap-2">
                <span className="f-mono text-sm font-semibold text-inchiostro">
                  {o.numero}
                </span>
                <span className="text-xs text-faint">{fmtData(o.created_at)}</span>
              </div>
              <PillStato stato={o.stato} tipo={o.tipo === "lac" ? "lac" : "busta"} />
            </Link>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-faint">
          Ancora nessun ordine per questo cliente.
        </p>
      )}
    </>
  );
}
