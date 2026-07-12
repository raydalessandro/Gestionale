import { PageHeader } from "@/components/ui";
import ClienteForm from "@/components/ClienteForm";

export default function NuovoClientePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titolo="Nuovo cliente"
        sotto="Bastano nome e cognome: il resto si completa strada facendo."
      />
      <ClienteForm />
    </div>
  );
}
