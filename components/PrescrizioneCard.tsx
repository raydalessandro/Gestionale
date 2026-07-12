import type { PrescrizioneRow } from "@/lib/database.types";
import { Card, Badge } from "@/components/ui";
import { fmtRefrazione, fmtDiottria, fmtData } from "@/lib/utils";

const ETICHETTE_USO: Record<string, string> = {
  lontano: "Lontano",
  vicino: "Vicino",
  progressivo: "Progressivo",
  bifocale: "Bifocale",
  office: "Office",
};

export default function PrescrizioneCard({ p }: { p: PrescrizioneRow }) {
  const haPrisma =
    p.od_prisma !== null || p.os_prisma !== null;
  const haLac = p.tipo === "lac";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tinta={haLac ? "verde" : "blu"}>
          {haLac ? "LAC" : "Occhiali"}
        </Badge>
        {p.uso && <Badge tinta="neutro">{ETICHETTE_USO[p.uso] ?? p.uso}</Badge>}
        {p.origine === "esterna" && (
          <Badge tinta="ottone">
            Ricetta esterna{p.esaminatore ? ` · ${p.esaminatore}` : ""}
          </Badge>
        )}
        <span className="ml-auto text-xs text-faint">
          {fmtData(p.data_visita)} · valida {p.validita_mesi} mesi
        </span>
      </div>

      <div className="f-mono space-y-1 rounded-xl bg-carta px-4 py-3 text-sm tabular-nums text-inchiostro">
        <p>
          <span className="mr-2 inline-block w-7 font-semibold">OD</span>
          {fmtRefrazione(p.od_sfero, p.od_cilindro, p.od_asse)}
          {haLac && p.od_raggio !== null && (
            <span className="text-soft">
              {"  "}· BC {p.od_raggio?.toFixed(1)} / DIA {p.od_diametro?.toFixed(1)}
            </span>
          )}
          {p.od_prisma !== null && (
            <span className="text-soft">
              {"  "}· Δ {fmtDiottria(p.od_prisma).replace("+", "")} base {p.od_prisma_base}
            </span>
          )}
        </p>
        <p>
          <span className="mr-2 inline-block w-7 font-semibold">OS</span>
          {fmtRefrazione(p.os_sfero, p.os_cilindro, p.os_asse)}
          {haLac && p.os_raggio !== null && (
            <span className="text-soft">
              {"  "}· BC {p.os_raggio?.toFixed(1)} / DIA {p.os_diametro?.toFixed(1)}
            </span>
          )}
          {p.os_prisma !== null && (
            <span className="text-soft">
              {"  "}· Δ {fmtDiottria(p.os_prisma).replace("+", "")} base {p.os_prisma_base}
            </span>
          )}
        </p>
        {p.addizione !== null && (
          <p>
            <span className="mr-2 inline-block w-7 font-semibold">ADD</span>
            {fmtDiottria(p.addizione)}
          </p>
        )}
      </div>

      {p.note && (
        <p className="mt-3 whitespace-pre-wrap text-xs text-soft">{p.note}</p>
      )}
    </Card>
  );
}
