import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Guscio from "@/components/Guscio";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profilo + azienda: se non esiste, l'utente deve completare l'onboarding.
  const { data: utente } = await supabase
    .from("utenti")
    .select("nome, azienda_id, aziende ( nome )")
    .eq("id", user.id)
    .single();

  if (!utente) redirect("/benvenuto");

  const aziendaNome =
    (utente.aziende as unknown as { nome: string } | null)?.nome ?? "Il tuo negozio";

  // Il guscio possiede la geometria: colonna, barra e area di contenuto stanno
  // insieme in un componente solo perché la barra vive DENTRO l'area a destra
  // della colonna, non sopra tutto. Le letture qui sopra sono invariate.
  return (
    <Guscio aziendaNome={aziendaNome} utenteNome={utente.nome}>
      {children}
    </Guscio>
  );
}
