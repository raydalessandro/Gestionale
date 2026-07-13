import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import WizardChiusura from "@/components/WizardChiusura";
import type { PagamentoVendita, RigaVendita } from "@/lib/database.types";

export default async function ChiusuraPage() {
  const supabase = await createClient();
  const oggi = new Date().toISOString().slice(0, 10);
  const inizio = `${oggi}T00:00:00`;
  const fine = `${oggi}T23:59:59`;

  const { data: esiste } = await supabase.from("chiusure_cassa").select("id").eq("data", oggi).maybeSingle();
  if (esiste) redirect(`/cassa/chiusure/${esiste.id}`);

  const [{ data: vendite }, { data: resi }, { data: ordiniOggi }, { data: incameri }, { data: chiusure }, { data: movCassa }, { data: ultima }] =
    await Promise.all([
      supabase.from("vendite").select("pagamenti, righe").eq("stato", "emessa").gte("data_vendita", inizio).lte("data_vendita", fine),
      supabase.from("resi").select("metodo_rimborso, importo").eq("tipo", "denaro").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("ordini_occhiali").select("acconto").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("movimenti_cassa").select("importo").eq("tipo", "incamero_caparra").gte("created_at", inizio).lte("created_at", fine),
      supabase.from("chiusure_cassa").select("versamento"),
      supabase.from("movimenti_cassa").select("tipo, importo"),
      supabase.from("chiusure_cassa").select("fondo_chiusura").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const sistemaMetodo = new Map<string, number>();
  const sistemaAliquota = new Map<string, number>();
  let caparreScontate = 0;
  for (const v of vendite ?? []) {
    for (const p of (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[]) {
      sistemaMetodo.set(p.nome, (sistemaMetodo.get(p.nome) ?? 0) + p.importo);
      if (p.nome.toLowerCase() === "caparra") caparreScontate += p.importo;
    }
    for (const r of (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[]) {
      const imp = Math.max(0, r.quantita * r.prezzo_unitario - r.sconto);
      sistemaAliquota.set(r.aliquota, (sistemaAliquota.get(r.aliquota) ?? 0) + imp);
    }
  }
  for (const r of resi ?? []) {
    const m = r.metodo_rimborso ?? "Contanti";
    sistemaMetodo.set(m, (sistemaMetodo.get(m) ?? 0) - r.importo);
  }

  if (!sistemaMetodo.has("Contanti")) sistemaMetodo.set("Contanti", 0);
  const metodi = [...sistemaMetodo.entries()].map(([nome, sistema]) => ({ nome, sistema: Math.round(sistema * 100) / 100 }));
  metodi.sort((a, b) => (a.nome === "Contanti" ? -1 : b.nome === "Contanti" ? 1 : a.nome.localeCompare(b.nome)));

  const aliquote = (["4", "22", "esente"] as const).map((a) => ({ aliquota: a, sistema: Math.round((sistemaAliquota.get(a) ?? 0) * 100) / 100 }));

  const caparre = {
    emesse: Math.round((ordiniOggi ?? []).reduce((s, o) => s + (o.acconto ?? 0), 0) * 100) / 100,
    scontate: Math.round(caparreScontate * 100) / 100,
    incamerate: Math.round((incameri ?? []).reduce((s, m) => s + m.importo, 0) * 100) / 100,
  };

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
        saldoCassaforte={Math.round(saldoCassaforte * 100) / 100}
      />
    </>
  );
}
