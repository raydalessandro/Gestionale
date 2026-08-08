import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import ClienteForm from "@/components/ClienteForm";

export default async function ModificaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: assicurazioni }] = await Promise.all([
    supabase.from("clienti").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("assicurazioni")
      .select("id, nome, attivo")
      .eq("attivo", true)
      .order("nome"),
  ]);

  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titolo={`${cliente.cognome} ${cliente.nome}`}
        sotto="Modifica anagrafica, contatti e consensi."
      />
      <ClienteForm cliente={cliente} assicurazioni={assicurazioni ?? []} />
    </div>
  );
}
