import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import PrescrizioneForm from "@/components/PrescrizioneForm";

export default async function NuovaPrescrizionePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clienti")
    .select("id, nome, cognome, consenso_dati_sanitari")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) notFound();

  const { data: oculisti } = await supabase
    .from("oculisti")
    .select("id, nome, studio")
    .order("nome");
  const { data: precedenti } = await supabase
    .from("prescrizioni")
    .select("id, data_visita, uso, ha_occhiali, ha_lac, plano")
    .eq("cliente_id", cliente.id)
    .order("data_visita", { ascending: false })
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titolo="Nuova prescrizione"
        sotto={`Per ${cliente.cognome} ${cliente.nome} · convenzione cilindro negativo, asse 0–180`}
      />
      <PrescrizioneForm
        clienteId={cliente.id}
        oculisti={oculisti ?? []}
        precedenti={precedenti ?? []}
      />
    </div>
  );
}
