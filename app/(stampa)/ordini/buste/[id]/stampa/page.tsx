import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottoneStampa from "@/components/BottoneStampa";
import { ETICHETTE_TIPO_LAVORO } from "@/components/OrdiniUI";
import {
  fmtRefrazione,
  fmtDiottria,
  fmtData,
  fmtEuro,
} from "@/lib/utils";
import type { PrescrizioneRow } from "@/lib/database.types";

export default async function StampaBustaPage({
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

  const [{ data: cliente }, { data: prescrizione }, { data: azienda }] =
    await Promise.all([
      b.cliente_id
        ? supabase.from("clienti").select("nome, cognome, telefono").eq("id", b.cliente_id).maybeSingle()
        : Promise.resolve({ data: null }),
      b.prescrizione_id
        ? supabase.from("prescrizioni").select("*").eq("id", b.prescrizione_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("aziende").select("nome").eq("id", b.azienda_id).maybeSingle(),
    ]);

  const p = prescrizione as PrescrizioneRow | null;

  return (
    <div className="mx-auto max-w-[210mm] p-8 font-serif text-[13px] leading-relaxed text-black">
      <BottoneStampa />

      {/* Intestazione */}
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-lg font-bold uppercase tracking-wide">
            {azienda?.nome ?? "Ottica"}
          </p>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Busta lavoro</p>
        </div>
        <p className="font-mono text-3xl font-bold">{b.numero}</p>
      </div>

      {/* Cliente + date */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Etichetta>Cliente</Etichetta>
          <p className="font-semibold">
            {cliente ? `${cliente.cognome} ${cliente.nome}` : "—"}
          </p>
          {cliente?.telefono && <p className="text-xs">{cliente.telefono}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs">
            Ordine: <span className="font-semibold">{fmtData(b.created_at)}</span>
          </p>
          {b.data_promessa && (
            <p className="text-xs">
              Promessa: <span className="font-semibold">{fmtData(b.data_promessa)}</span>
            </p>
          )}
          <p className="mt-1 text-xs uppercase tracking-wide">
            {ETICHETTE_TIPO_LAVORO[b.tipo_lavoro]}
          </p>
        </div>
      </div>

      {/* Prescrizione */}
      <Sezione titolo="Prescrizione">
        {p ? (
          <div className="font-mono text-[13px]">
            <p>
              <span className="mr-3 inline-block w-8 font-bold">OD</span>
              {fmtRefrazione(p.od_sfero, p.od_cilindro, p.od_asse)}
              {p.od_prisma != null &&
                `  ·  Δ ${fmtDiottria(p.od_prisma).replace("+", "")} base ${p.od_prisma_base ?? ""}`}
            </p>
            <p>
              <span className="mr-3 inline-block w-8 font-bold">OS</span>
              {fmtRefrazione(p.os_sfero, p.os_cilindro, p.os_asse)}
              {p.os_prisma != null &&
                `  ·  Δ ${fmtDiottria(p.os_prisma).replace("+", "")} base ${p.os_prisma_base ?? ""}`}
            </p>
            {p.addizione != null && (
              <p>
                <span className="mr-3 inline-block w-8 font-bold">ADD</span>
                {fmtDiottria(p.addizione)}
              </p>
            )}
            {(p.od_dnp != null || p.os_dnp != null) && (
              <p>
                <span className="mr-3 inline-block w-8 font-bold">DNP</span>
                OD {p.od_dnp ?? "—"} · OS {p.os_dnp ?? "—"} mm
              </p>
            )}
          </div>
        ) : (
          <p className="text-neutral-600">Nessuna prescrizione collegata.</p>
        )}
      </Sezione>

      {/* Montatura */}
      <Sezione titolo="Montatura">
        <DueColonne>
          <Voce label="Marca / modello" valore={[b.montatura_marca, b.montatura_modello].filter(Boolean).join(" ") || "—"} />
          <Voce label="Colore" valore={b.montatura_colore || "—"} />
          <Voce label="Calibro" valore={b.montatura_calibro || "—"} mono />
          <Voce label="UPC" valore={b.montatura_upc || "—"} mono />
        </DueColonne>
      </Sezione>

      {/* Lenti */}
      <Sezione titolo="Lenti">
        <DueColonne>
          <Voce label="Tipo" valore={b.lente_tipo || "—"} />
          <Voce label="Materiale / indice" valore={[b.lente_materiale, b.lente_indice].filter(Boolean).join(" · ") || "—"} />
          <Voce label="Trattamenti" valore={b.trattamenti.length ? b.trattamenti.join(", ") : "—"} />
          {b.garanzia && <Voce label="Garanzia" valore={b.garanzia} />}
        </DueColonne>
      </Sezione>

      {/* Centratura */}
      <Sezione titolo="Centratura">
        <table className="w-full max-w-xs font-mono text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-neutral-600">
              <th className="py-1"></th>
              <th className="py-1">DNP</th>
              <th className="py-1">Altezza</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-0.5 font-bold">OD</td>
              <td>{b.od_dnp ?? "—"}</td>
              <td>{b.od_altezza ?? "—"}</td>
            </tr>
            <tr>
              <td className="py-0.5 font-bold">OS</td>
              <td>{b.os_dnp ?? "—"}</td>
              <td>{b.os_altezza ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      </Sezione>

      {/* Economia */}
      <Sezione titolo="Economia">
        <div className="max-w-xs space-y-0.5 font-mono text-[13px]">
          <Riga label="Totale" valore={fmtEuro(b.totale)} />
          <Riga label="Acconto" valore={fmtEuro(b.acconto)} />
          <div className="mt-1 border-t border-black pt-1">
            <Riga label="Saldo alla consegna" valore={fmtEuro(b.saldo)} forte />
          </div>
        </div>
      </Sezione>

      {(b.laboratorio || b.note) && (
        <Sezione titolo="Laboratorio e note">
          {b.laboratorio && <p className="text-xs">Laboratorio: {b.laboratorio}</p>}
          {b.note && <p className="whitespace-pre-wrap text-xs">{b.note}</p>}
        </Sezione>
      )}

      {/* Firme */}
      <div className="mt-10 grid grid-cols-2 gap-8">
        <Firma testo="Operatore" />
        <Firma testo="Cliente al ritiro" />
      </div>
    </div>
  );
}

function Etichetta({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-widest text-neutral-600">{children}</p>;
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-neutral-300 pt-3">
      <Etichetta>{titolo}</Etichetta>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DueColonne({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1">{children}</div>;
}

function Voce({ label, valore, mono }: { label: string; valore: string; mono?: boolean }) {
  return (
    <p className="text-xs">
      <span className="text-neutral-600">{label}: </span>
      <span className={mono ? "font-mono" : "font-semibold"}>{valore}</span>
    </p>
  );
}

function Riga({ label, valore, forte }: { label: string; valore: string; forte?: boolean }) {
  return (
    <div className={`flex justify-between ${forte ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span>{valore}</span>
    </div>
  );
}

function Firma({ testo }: { testo: string }) {
  return (
    <div>
      <div className="mt-8 border-t border-black" />
      <p className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600">{testo}</p>
    </div>
  );
}
