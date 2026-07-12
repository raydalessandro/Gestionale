import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

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

  return (
    <div className="flex min-h-screen flex-col bg-carta md:flex-row">
      <Sidebar aziendaNome={aziendaNome} utenteNome={utente.nome} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
