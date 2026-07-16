import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, ButtonLink, Badge } from "@/components/ui";
import {
  BadgeTipoProdotto,
  PillFermo,
  QuantitaMovimento,
  etichettaMovimento,
  sottoScorta,
  fermoScaduto,
  parametriLac,
  parametriMontatura,
} from "@/components/MagazzinoUI";
import { AzioniProdotto, AzioniFermo } from "@/components/AzioniMagazzino";
import { fmtEuro, fmtQuando, fmtData, ETICHETTE_RICAMBIO } from "@/lib/utils";

export default async function ProdottoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase.from("prodotti").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: movimenti }, { data: fermi }] = await Promise.all([
    supabase
      .from("movimenti_magazzino")
      .select("id, tipo, quantita, riferimento, note, utente_id, created_at")
      .eq("prodotto_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("fermi")
      .select("id, cliente_id, quantita, stato, scade_il, note, created_at")
      .eq("prodotto_id", id)
      .eq("stato", "attivo")
      .order("created_at", { ascending: false }),
  ]);

  const impegnata = (fermi ?? []).reduce((s, f) => s + f.quantita, 0);
  const disponibile = p.giacenza - impegnata;
  const lac = parametriLac(p.parametri);
  const mont =
    p.tipo === "montatura" || p.tipo === "sole"
      ? parametriMontatura(p.parametri)
      : null;

  // Nomi utenti dei movimenti + clienti dei fermi
  const utenteIds = [...new Set((movimenti ?? []).map((m) => m.utente_id).filter(Boolean))] as string[];
  const clienteIds = [...new Set((fermi ?? []).map((f) => f.cliente_id))];
  const [{ data: utenti }, { data: clienti }] = await Promise.all([
    utenteIds.length ? supabase.from("utenti").select("id, nome").in("id", utenteIds) : Promise.resolve({ data: [] }),
    clienteIds.length ? supabase.from("clienti").select("id, nome, cognome").in("id", clienteIds) : Promise.resolve({ data: [] }),
  ]);
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome]));
  const nomeCliente = new Map((clienti ?? []).map((c) => [c.id, `${c.cognome} ${c.nome}`]));

  const scorta = sottoScorta(p);

  return (
    <>
      <PageHeader
        titolo=""
        azione={
          <ButtonLink href={`/magazzino/prodotti/${p.id}/modifica`} variante="ghost">
            <Pencil size={15} /> Modifica
          </ButtonLink>
        }
      />
      <div className="-mt-2 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="f-serif text-2xl font-semibold text-inchiostro">
            {[p.marca, p.nome].filter(Boolean).join(" ")}
          </h1>
          <BadgeTipoProdotto tipo={p.tipo} />
          {!p.attivo && <Badge tinta="neutro">Disattivato</Badge>}
        </div>
        {p.sku && <p className="f-mono mt-1 text-xs uppercase tracking-wide text-soft">SKU {p.sku}</p>}
      </div>

      {/* Tre numeri */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <NumeroGrande valore={p.giacenza} label="Giacenza" rosso={scorta} />
        <NumeroGrande valore={impegnata} label="Impegnata (fermi)" />
        <NumeroGrande valore={disponibile} label="Disponibile" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Dato label="Prezzo" valore={fmtEuro(p.prezzo)} />
          <Dato label="Costo" valore={p.costo != null ? fmtEuro(p.costo) : "—"} />
          <Dato label="Fornitore" valore={p.fornitore || "—"} />
          <Dato label="Scorta minima" valore={String(p.scorta_minima)} />
          {p.tipo === "lac" && (
            <Dato
              label="Parametri LAC"
              valore={[lac.raggio && `BC ${lac.raggio}`, lac.diametro && `DIA ${lac.diametro}`, lac.confezione].filter(Boolean).join(" · ") || "—"}
              mono
              full
            />
          )}
          {p.tipo === "lac" && (
            <Dato label="Ricambio" valore={p.ricambio_giorni != null ? (ETICHETTE_RICAMBIO[String(p.ricambio_giorni)] ?? `${p.ricambio_giorni} gg`) : "—"} />
          )}
          {mont && (
            <Dato
              label="Parametri montatura"
              valore={[
                mont.calibro && `calibro ${mont.calibro}`,
                mont.ponte && `ponte ${mont.ponte}`,
                mont.asta && `asta ${mont.asta}`,
                [mont.colore_nome, mont.colore_codice && `(${mont.colore_codice})`].filter(Boolean).join(" "),
                mont.materiale,
              ].filter(Boolean).join(" · ") || "—"}
              mono
              full
            />
          )}
          {p.descrizione && <Dato label="Descrizione" valore={p.descrizione} full />}
        </Card>
        <Card className="flex items-center justify-center">
          {p.visibile_sito ? (
            <Badge tinta="verde">Visibile sul sito</Badge>
          ) : (
            <Badge tinta="neutro">Non sul sito</Badge>
          )}
        </Card>
      </div>

      {/* Azioni */}
      <Card className="mb-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">Movimenti e fermi</p>
        <AzioniProdotto prodottoId={p.id} disponibile={disponibile} />
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Movimenti */}
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Ultimi movimenti</p>
          {movimenti && movimenti.length > 0 ? (
            <ul className="divide-y divide-linea/70">
              {movimenti.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-inchiostro">{etichettaMovimento(m.tipo)}</p>
                    <p className="truncate text-[11px] text-faint">
                      {fmtQuando(m.created_at)}
                      {m.riferimento ? ` · ${m.riferimento}` : ""}
                      {m.utente_id && nomeUtente.get(m.utente_id) ? ` · ${nomeUtente.get(m.utente_id)}` : ""}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <QuantitaMovimento quantita={m.quantita} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Nessun movimento ancora.</p>
          )}
        </Card>

        {/* Fermi attivi */}
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Fermi attivi</p>
          {fermi && fermi.length > 0 ? (
            <ul className="space-y-3">
              {fermi.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/clienti/${f.cliente_id}`} className="text-sm font-semibold text-inchiostro hover:underline">
                      {nomeCliente.get(f.cliente_id) ?? "Cliente"}
                    </Link>
                    <p className="text-[11px] text-faint">
                      {f.quantita} pz ·{" "}
                      {f.scade_il ? (
                        <span className={fermoScaduto(f) ? "font-semibold text-rosso" : ""}>
                          scade {fmtData(f.scade_il)}
                        </span>
                      ) : (
                        "senza scadenza"
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <PillFermo stato={f.stato} />
                    <AzioniFermo id={f.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Nessun fermo attivo.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function NumeroGrande({ valore, label, rosso }: { valore: number; label: string; rosso?: boolean }) {
  return (
    <div className="rounded-2xl border border-linea bg-white p-4 text-center shadow-[0_1px_2px_rgba(28,23,20,0.04)]">
      <p className={`f-mono text-3xl font-semibold tabular-nums ${rosso ? "text-rosso" : "text-inchiostro"}`}>
        {valore}
      </p>
      <p className="mt-1 text-xs font-medium text-soft">{label}</p>
    </div>
  );
}

function Dato({ label, valore, mono, full }: { label: string; valore: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-4" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`text-sm text-inchiostro ${mono ? "f-mono" : ""}`}>{valore}</p>
    </div>
  );
}
