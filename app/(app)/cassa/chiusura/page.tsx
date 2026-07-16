import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import WizardChiusura from "@/components/WizardChiusura";
import type { RigaVendita } from "@/lib/database.types";
import {
  sistemaPerMetodo,
  caparreSenzaMetodo,
  contatoriCaparre,
  NOME_CAPARRA,
} from "@/lib/cassa-calcoli";

const e2 = (n: number) => Math.round(n * 100) / 100;

export default async function ChiusuraPage() {
  const supabase = await createClient();
  const oggi = new Date().toISOString().slice(0, 10);
  const inizio = `${oggi}T00:00:00`;
  const fine = `${oggi}T23:59:59`;

  const { data: esiste } = await supabase.from("chiusure_cassa").select("id").eq("data", oggi).maybeSingle();
  if (esiste) redirect(`/cassa/chiusure/${esiste.id}`);

  const [{ data: vendite }, { data: resi }, { data: accontiOggi }, { data: incameri }, { data: chiusure }, { data: movCassa }, { data: ultima }] =
    await Promise.all([
      supabase.from("vendite").select("pagamenti, righe").eq("stato", "emessa").gte("data_vendita", inizio).lte("data_vendita", fine),
      supabase.from("resi").select("metodo_rimborso, importo, busta_id").eq("tipo", "denaro").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("ordini_occhiali").select("acconto, acconto_metodo").gte("acconto_incassato_il", inizio).lte("acconto_incassato_il", fine),
      supabase.from("movimenti_cassa").select("importo").eq("tipo", "incamero_caparra").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("chiusure_cassa").select("versamento"),
      supabase.from("movimenti_cassa").select("tipo, importo"),
      supabase.from("chiusure_cassa").select("fondo_chiusura").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);

  // Formula condivisa (§2.2): la voce 'Caparra' esce dal blocco conta.
  const resiDenaro = resi ?? [];
  const acconti = accontiOggi ?? [];
  const sistemaMetodo = sistemaPerMetodo(vendite ?? [], resiDenaro, acconti);

  // Sistema per aliquota (imponibile+iva per aliquota della riga)
  const sistemaAliquota = new Map<string, number>();
  for (const v of vendite ?? []) {
    for (const r of (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[]) {
      const imp = Math.max(0, r.quantita * r.prezzo_unitario - r.sconto);
      sistemaAliquota.set(r.aliquota, e2((sistemaAliquota.get(r.aliquota) ?? 0) + imp));
    }
  }

  if (!sistemaMetodo.has("Contanti")) sistemaMetodo.set("Contanti", 0);
  const metodi = [...sistemaMetodo.entries()]
    .filter(([nome]) => nome.toLowerCase() !== NOME_CAPARRA)
    .map(([nome, sistema]) => ({ nome, sistema: e2(sistema) }));
  metodi.sort((a, b) => (a.nome === "Contanti" ? -1 : b.nome === "Contanti" ? 1 : a.nome.localeCompare(b.nome)));

  const aliquote = (["4", "22", "esente"] as const).map((a) => ({ aliquota: a, sistema: e2(sistemaAliquota.get(a) ?? 0) }));

  const contatori = contatoriCaparre({
    accontiEmessiOggi: acconti,
    venditeOggi: vendite ?? [],
    resiCaparraOggi: resiDenaro.filter((r) => r.busta_id),
    incameriOggi: incameri ?? [],
  });
  const caparre = { ...contatori, senzaMetodo: caparreSenzaMetodo(acconti) };

  const saldoCassaforte =
    (chiusure ?? []).reduce((s, c) => s + (c.versamento ?? 0), 0) +
    (movCassa ?? []).filter((m) => m.tipo === "versamento_cassaforte").reduce((s, m) => s + m.importo, 0) -
    (movCassa ?? []).filter((m) => m.tipo === "versamento_banca").reduce((s, m) => s + m.importo, 0);

  return (
    <>
      <PageHeader titolo="Chiusura di giornata" sotto="Conta, confronta col registratore, versa. Una per oggi." />
      <WizardChiusura
        metodi={metodi}
        aliquote={aliquote}
        caparre={caparre}
        fondoApertura={ultima?.fondo_chiusura ?? 300}
        saldoCassaforte={e2(saldoCassaforte)}
      />
    </>
  );
}
