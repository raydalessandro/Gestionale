import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import WizardBusta from "@/components/WizardBusta";

export default async function NuovaBustaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const supabase = await createClient();

  let clientePre = null;
  if (cliente) {
    const { data } = await supabase
      .from("clienti")
      .select("id, nome, cognome, telefono")
      .eq("id", cliente)
      .maybeSingle();
    clientePre = data;
  }

  return (
    <>
      <PageHeader
        titolo="Nuova busta lavoro"
        sotto="Dalla montatura alla centratura: l'ordine dell'occhiale, passo per passo."
      />
      <WizardBusta clientePreselezionato={clientePre} />
    </>
  );
}
