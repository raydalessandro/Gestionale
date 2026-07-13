import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Badge, Vuoto } from "@/components/ui";
import { SeedMetodi, NuovoMetodo, RigaMetodo } from "@/components/MetodiCassa";

export default async function ImpostazioniCassaPage() {
  const supabase = await createClient();
  const { data: metodi } = await supabase
    .from("metodi_pagamento")
    .select("*")
    .order("ordine")
    .order("nome");

  return (
    <>
      <PageHeader
        titolo="Metodi di pagamento"
        sotto="Ogni negozio attiva i suoi. Il metodo Caparra non si tocca."
        azione={metodi && metodi.length > 0 ? <NuovoMetodo /> : undefined}
      />

      {metodi && metodi.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {metodi.map((m) => (
            <RigaMetodo key={m.id} metodo={m} />
          ))}
        </Card>
      ) : (
        <Vuoto
          titolo="Nessun metodo di pagamento"
          testo="Parti dai metodi di base: Contanti, Bancomat, Mastercard, Visa, Bonifico, Gift Card, Assicurazione e Caparra. Li potrai personalizzare dopo."
          azione={<SeedMetodi />}
        />
      )}

      <p className="mt-4 text-xs text-faint">
        <Badge tinta="neutro">tracciabile</Badge> distingue i pagamenti tracciati
        (utile alla detraibilità); solo i contanti sono non tracciabili.
      </p>
    </>
  );
}
