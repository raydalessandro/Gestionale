import { PageHeader } from "@/components/ui";
import ProdottoForm from "@/components/ProdottoForm";

export default function NuovoProdottoPage() {
  return (
    <>
      <PageHeader
        titolo="Nuovo prodotto"
        sotto="Anagrafica di catalogo. La giacenza si muove poi con i movimenti."
      />
      <ProdottoForm />
    </>
  );
}
