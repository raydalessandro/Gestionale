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
    .select("id, nome, cognome")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titolo="Nuova prescrizione"
        sotto={`Per ${cliente.cognome} ${cliente.nome} · convenzione cilindro negativo, asse 0–180`}
      />
      <PrescrizioneForm clienteId={cliente.id} />
    </div>
  );
}
