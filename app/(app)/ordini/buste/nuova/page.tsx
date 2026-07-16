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

  // Metodi con cui si può incassare la caparra (esclusa la voce 'Caparra').
  const { data: metodiRow } = await supabase
    .from("metodi_pagamento")
    .select("nome, tipo")
    .eq("attivo", true)
    .order("ordine");
  const metodi = (metodiRow ?? [])
    .filter((m) => m.tipo !== "caparra")
    .map((m) => m.nome);
  const metodiCaparra = metodi.length ? metodi : ["Contanti", "Bancomat", "Mastercard"];

  return (
    <>
      <PageHeader
        titolo="Nuova busta lavoro"
        sotto="Dalla montatura alla centratura: l'ordine dell'occhiale, passo per passo."
      />
      <WizardBusta clientePreselezionato={clientePre} metodiCaparra={metodiCaparra} />
    </>
  );
}
