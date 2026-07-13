import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import FormAppuntamento from "@/components/FormAppuntamento";

export default async function NuovoAppuntamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; tipo?: string; riferimento?: string; data?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profilo }, clientePre] = await Promise.all([
    user
      ? supabase.from("utenti").select("id, azienda_id").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    sp.cliente
      ? supabase.from("clienti").select("id, nome, cognome").eq("id", sp.cliente).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: utenti } = await supabase
    .from("utenti")
    .select("id, nome")
    .eq("attivo", true)
    .order("nome");

  return (
    <>
      <PageHeader titolo="Nuovo appuntamento" sotto="Fissa un ritiro, un controllo o un impegno." />
      <FormAppuntamento
        clientePreselezionato={clientePre.data ?? null}
        utenti={utenti ?? []}
        utenteCorrente={profilo?.id ?? ""}
        prefill={{ tipo: sp.tipo, riferimento: sp.riferimento, data: sp.data }}
      />
    </>
  );
}
