import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import ProdottoForm from "@/components/ProdottoForm";

export default async function ModificaProdottoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: prodotto } = await supabase
    .from("prodotti")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!prodotto) notFound();

  return (
    <>
      <PageHeader titolo="Modifica prodotto" sotto={prodotto.nome} />
      <ProdottoForm prodotto={prodotto} />
    </>
  );
}
