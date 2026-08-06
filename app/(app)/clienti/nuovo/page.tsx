import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import ClienteForm from "@/components/ClienteForm";

export default async function NuovoClientePage() {
  const supabase = await createClient();
  // Catalogo globale (M1 §4): la voce NESSUNA c'è sempre, la semina la 021.
  const { data: assicurazioni } = await supabase
    .from("assicurazioni")
    .select("id, nome, attivo")
    .eq("attivo", true)
    .order("nome");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titolo="Nuovo cliente"
        sotto="Bastano nome e cognome: il resto si completa strada facendo."
      />
      <ClienteForm assicurazioni={assicurazioni ?? []} />
    </div>
  );
}
