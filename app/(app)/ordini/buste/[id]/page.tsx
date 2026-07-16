import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, ButtonLink, Badge, tintaFonte } from "@/components/ui";
import { PillStato, RxMono, waLink, ETICHETTE_TIPO_LAVORO } from "@/components/OrdiniUI";
import { AzioniBusta, NotaRapida } from "@/components/AzioniOrdine";
import { AzioniCaparra } from "@/components/AzioniCaparra";
import { fmtEuro, fmtData, ETICHETTE_FONTE } from "@/lib/utils";

export default async function BustaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("ordini_occhiali")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();

  const [{ data: cliente }, { data: prescrizione }, { data: azienda }, ispettore] =
    await Promise.all([
      b.cliente_id
        ? supabase
            .from("clienti")
            .select("id, nome, cognome, telefono")
            .eq("id", b.cliente_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      b.prescrizione_id
        ? supabase.from("prescrizioni").select("*").eq("id", b.prescrizione_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("aziende").select("nome").eq("id", b.azienda_id).maybeSingle(),
      b.ispezionata_da
        ? supabase.from("utenti").select("nome").eq("id", b.ispezionata_da).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const { data: metodiRow } = await supabase
    .from("metodi_pagamento").select("id, nome, tipo").eq("attivo", true).order("ordine");
  const metodiTutti = metodiRow ?? [];
  const metodiCassa = metodiTutti.map((m) => ({ id: m.id, nome: m.nome }));
  const metodiCaparra = metodiTutti.filter((m) => m.tipo !== "caparra").map((m) => m.nome);

  const accontoSuggerito = Math.round((b.totale * 0.3) / 5) * 5;

  const waHref = cliente?.telefono
    ? waLink(
        cliente.telefono,
        `Ciao ${cliente.nome}! Il tuo occhiale è pronto 👓 Ti aspettiamo per la consegna. — ${azienda?.nome ?? ""}`
      )
    : null;

  const cronologia = [
    { data: b.created_at, evento: "Busta creata" },
    b.ispezionata_il && {
      data: b.ispezionata_il,
      evento: `Ispezionata${ispettore?.data?.nome ? ` da ${ispettore.data.nome}` : ""}`,
    },
    b.avvisato_il && { data: b.avvisato_il, evento: "Cliente avvisato" },
    b.data_consegna && { data: b.data_consegna, evento: "Consegnata" },
    b.caparra_incamerata_il && {
      data: b.caparra_incamerata_il,
      evento: "Caparra incamerata",
    },
  ].filter(Boolean) as { data: string; evento: string }[];

  const centratura = [b.od_dnp, b.os_dnp, b.od_altezza, b.os_altezza].some((v) => v != null);

  return (
    <>
      <PageHeader
        titolo=""
        azione={
          <div className="flex items-center gap-2">
            <Badge tinta={tintaFonte(b.fonte)}>
              {ETICHETTE_FONTE[b.fonte] ?? b.fonte}
            </Badge>
            <PillStato stato={b.stato} tipo="busta" />
          </div>
        }
      />
      <div className="-mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-mono text-3xl font-semibold tracking-tight text-inchiostro">
            {b.numero}
          </h1>
          <p className="mt-1 text-sm text-soft">
            Busta lavoro · {ETICHETTE_TIPO_LAVORO[b.tipo_lavoro]}
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/ordini/buste/${b.id}/stampa`} variante="ghost">
            <Printer size={16} /> Stampa busta
          </ButtonLink>
          {b.acconto > 0 && (
            <ButtonLink href={`/ordini/buste/${b.id}/caparra`} variante="ghost">
              <Printer size={16} /> Ricevuta caparra
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Card className="space-y-3">
            {cliente ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/clienti/${cliente.id}`}
                  className="text-sm font-semibold text-inchiostro hover:underline"
                >
                  {cliente.cognome} {cliente.nome}
                </Link>
                {cliente.telefono && (
                  <span className="flex items-center gap-1.5 text-sm text-soft">
                    <Phone size={14} className="text-ottone" /> {cliente.telefono}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-faint">Cliente rimosso</p>
            )}
            <div className="rounded-xl bg-carta px-4 py-3">
              {prescrizione ? (
                <RxMono p={prescrizione} />
              ) : (
                <span className="text-xs text-faint">Nessuna prescrizione collegata</span>
              )}
            </div>
          </Card>

          <Blocco titolo="Montatura">
            <Dato label="Marca / modello" valore={[b.montatura_marca, b.montatura_modello].filter(Boolean).join(" ") || "—"} />
            <Dato label="Colore" valore={b.montatura_colore || "—"} />
            <Dato label="Calibro" valore={b.montatura_calibro || "—"} mono />
            <Dato label="UPC" valore={b.montatura_upc || "—"} mono />
          </Blocco>

          <Blocco titolo="Lenti e trattamenti">
            <Dato label="Tipo" valore={b.lente_tipo || "—"} />
            <Dato label="Materiale" valore={b.lente_materiale || "—"} />
            <Dato label="Indice" valore={b.lente_indice || "—"} mono />
            <Dato
              label="Trattamenti"
              valore={b.trattamenti.length ? b.trattamenti.join(", ") : "—"}
            />
            {b.garanzia && <Dato label="Garanzia" valore={b.garanzia} />}
          </Blocco>

          {centratura && (
            <Blocco titolo="Centratura">
              <div className="col-span-2 overflow-x-auto">
                <table className="f-mono w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                      <th className="py-1 font-semibold"></th>
                      <th className="py-1 font-semibold">DNP</th>
                      <th className="py-1 font-semibold">Altezza</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1 font-semibold">OD</td>
                      <td className="py-1">{b.od_dnp ?? "—"}</td>
                      <td className="py-1">{b.od_altezza ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold">OS</td>
                      <td className="py-1">{b.os_dnp ?? "—"}</td>
                      <td className="py-1">{b.os_altezza ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Blocco>
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-2">
            <RigaEconomia label="Montatura" valore={b.prezzo_montatura} />
            <RigaEconomia label="Lenti" valore={b.prezzo_lenti} />
            <RigaEconomia label="Extra" valore={b.prezzo_extra} />
            {b.sconto > 0 && <RigaEconomia label="Sconto" valore={-b.sconto} />}
            <div className="border-t border-linea pt-2">
              <RigaEconomia label="Totale" valore={b.totale} />
            </div>
            <RigaEconomia label="Acconto" valore={b.acconto} />
            <div className="rounded-xl bg-ottone-soft px-3 py-2">
              <RigaEconomia label="Saldo" valore={b.saldo} forte />
            </div>
          </Card>

          <Card className="space-y-1.5 text-xs text-soft">
            <p>Ordine: {fmtData(b.created_at)}</p>
            {b.data_promessa && <p>Promessa: {fmtData(b.data_promessa)}</p>}
            {b.data_consegna && <p>Consegna: {fmtData(b.data_consegna)}</p>}
            {b.laboratorio && <p>Laboratorio: {b.laboratorio}</p>}
          </Card>
        </div>
      </div>

      <Card className="mb-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Azioni</p>
        <AzioniBusta
          id={b.id}
          stato={b.stato}
          saldo={b.saldo}
          accontoSuggerito={accontoSuggerito}
          waHref={waHref}
          fissaRitiroHref={
            b.cliente_id
              ? `/agenda/nuovo?cliente=${b.cliente_id}&tipo=consegna&riferimento=${encodeURIComponent(b.numero)}`
              : null
          }
          incassaHref={`/cassa/vendita/nuova?busta=${b.id}`}
          metodiCaparra={metodiCaparra}
        />
        {b.acconto > 0 && !["consegnata", "annullata"].includes(b.stato) && (
          <div className="mt-3 border-t border-linea pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Caparra {b.acconto_metodo ? `· incassata: ${b.acconto_metodo}` : ""}
            </p>
            <AzioniCaparra bustaId={b.id} acconto={b.acconto} metodi={metodiCassa} metodoIncasso={b.acconto_metodo} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Cronologia
          </p>
          <ul className="space-y-1.5 text-sm">
            {cronologia.map((c, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-inchiostro">{c.evento}</span>
                <span className="text-xs text-faint">{fmtData(c.data)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Note</p>
          {b.note ? (
            <p className="whitespace-pre-wrap text-sm text-soft">{b.note}</p>
          ) : (
            <p className="text-sm text-faint">Nessuna nota.</p>
          )}
          <NotaRapida tipo="buste" id={b.id} />
        </Card>
      </div>
    </>
  );
}

function Blocco({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">{titolo}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </Card>
  );
}

function Dato({ label, valore, mono }: { label: string; valore: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`text-sm text-inchiostro ${mono ? "f-mono" : ""}`}>{valore}</p>
    </div>
  );
}

function RigaEconomia({
  label,
  valore,
  forte,
}: {
  label: string;
  valore: number;
  forte?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${forte ? "font-semibold text-inchiostro" : "text-soft"}`}>
        {label}
      </span>
      <span
        className={`f-mono tabular-nums ${forte ? "text-lg font-semibold text-inchiostro" : "text-sm text-inchiostro"}`}
      >
        {fmtEuro(valore)}
      </span>
    </div>
  );
}
