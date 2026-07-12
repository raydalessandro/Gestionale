import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, tintaFonte } from "@/components/ui";
import { PillStato, RxMono, waLink } from "@/components/OrdiniUI";
import { AzioniLac, NotaRapida } from "@/components/AzioniOrdine";
import { fmtEuro, fmtData, ETICHETTE_FONTE } from "@/lib/utils";
import type { RigaOrdineLac } from "@/lib/database.types";

export default async function OrdineLacPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ordine } = await supabase
    .from("ordini_lac")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!ordine) notFound();

  const [{ data: cliente }, { data: prescrizione }, { data: azienda }] =
    await Promise.all([
      ordine.cliente_id
        ? supabase
            .from("clienti")
            .select("id, nome, cognome, telefono")
            .eq("id", ordine.cliente_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ordine.prescrizione_id
        ? supabase
            .from("prescrizioni")
            .select("*")
            .eq("id", ordine.prescrizione_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("aziende").select("nome").eq("id", ordine.azienda_id).maybeSingle(),
    ]);

  const righe = (Array.isArray(ordine.righe) ? ordine.righe : []) as RigaOrdineLac[];
  const saldo = ordine.totale - ordine.acconto;

  const waHref =
    cliente?.telefono
      ? waLink(
          cliente.telefono,
          `Ciao ${cliente.nome}! Le tue lenti sono arrivate in negozio, quando vuoi passare a ritirarle? — ${azienda?.nome ?? ""}`
        )
      : null;

  const cronologia = [
    { data: ordine.created_at, evento: "Ordine creato" },
    ordine.avvisato_il && { data: ordine.avvisato_il, evento: "Cliente avvisato" },
    ordine.data_consegna && { data: ordine.data_consegna, evento: "Consegnato" },
  ].filter(Boolean) as { data: string; evento: string }[];

  return (
    <>
      <PageHeader
        titolo=""
        azione={
          <div className="flex items-center gap-2">
            <Badge tinta={tintaFonte(ordine.fonte)}>
              {ETICHETTE_FONTE[ordine.fonte] ?? ordine.fonte}
            </Badge>
            <PillStato stato={ordine.stato} tipo="lac" />
          </div>
        }
      />
      <div className="-mt-2 mb-6">
        <h1 className="f-mono text-3xl font-semibold tracking-tight text-inchiostro">
          {ordine.numero}
        </h1>
        <p className="mt-1 text-sm text-soft">Ordine lenti a contatto</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 space-y-3">
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

          {/* Righe */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="py-2 font-semibold">Descrizione</th>
                  <th className="py-2 font-semibold">Occhio</th>
                  <th className="py-2 text-right font-semibold">Q.tà</th>
                  <th className="py-2 text-right font-semibold">Prezzo</th>
                  <th className="py-2 text-right font-semibold">Subtot.</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r, i) => (
                  <tr key={i} className="border-b border-linea/60">
                    <td className="py-2 text-inchiostro">
                      {r.descrizione}
                      {r.parametri && parametriTesto(r.parametri) && (
                        <span className="f-mono block text-[11px] text-soft">
                          {parametriTesto(r.parametri)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 f-mono text-soft">{r.occhio ?? "—"}</td>
                    <td className="py-2 text-right f-mono tabular-nums">{r.quantita}</td>
                    <td className="py-2 text-right f-mono tabular-nums">{fmtEuro(r.prezzo)}</td>
                    <td className="py-2 text-right f-mono tabular-nums">
                      {fmtEuro(r.quantita * r.prezzo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-2">
          <RigaEconomia label="Totale" valore={ordine.totale} />
          <RigaEconomia label="Acconto" valore={ordine.acconto} />
          <div className="border-t border-linea pt-2">
            <RigaEconomia label="Saldo" valore={saldo} forte />
          </div>
          {ordine.data_arrivo_prevista && (
            <p className="pt-2 text-xs text-faint">
              Arrivo previsto: {fmtData(ordine.data_arrivo_prevista)}
            </p>
          )}
        </Card>
      </div>

      {/* Azioni */}
      <Card className="mb-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Azioni</p>
        <AzioniLac id={ordine.id} stato={ordine.stato} waHref={waHref} />
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
          {ordine.note ? (
            <p className="whitespace-pre-wrap text-sm text-soft">{ordine.note}</p>
          ) : (
            <p className="text-sm text-faint">Nessuna nota.</p>
          )}
          <NotaRapida tipo="lac" id={ordine.id} />
        </Card>
      </div>
    </>
  );
}

function parametriTesto(p: RigaOrdineLac["parametri"]): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.sfero != null) parts.push(`sf ${p.sfero}`);
  if (p.cilindro != null) parts.push(`cil ${p.cilindro}`);
  if (p.asse != null) parts.push(`ax ${p.asse}`);
  if (p.raggio != null) parts.push(`BC ${p.raggio}`);
  if (p.diametro != null) parts.push(`DIA ${p.diametro}`);
  if (p.addizione != null) parts.push(`ADD ${p.addizione}`);
  return parts.join(" · ");
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
