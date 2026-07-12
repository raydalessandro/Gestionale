import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import WizardOrdineLac from "@/components/WizardOrdineLac";

export default async function NuovoOrdineLacPage({
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
        titolo="Nuovo ordine LAC"
        sotto="Lenti a contatto dal banco: cliente, prescrizione, righe."
      />
      <WizardOrdineLac clientePreselezionato={clientePre} />
    </>
  );
}
