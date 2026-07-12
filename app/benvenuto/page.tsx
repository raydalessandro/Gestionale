import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function BenvenutoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Se il profilo esiste già, dritti in dashboard.
  const { data: utente } = await supabase
    .from("utenti")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (utente) redirect("/dashboard");

  const nomeSuggerito =
    (user.user_metadata?.nome as string | undefined) ?? "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-carta px-4">
      <div className="mb-6 flex items-baseline gap-2">
        <span className="f-serif text-3xl font-semibold tracking-tight text-inchiostro">
          VISTA
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-ottone">
          gestionale
        </span>
      </div>
      <OnboardingForm nomeSuggerito={nomeSuggerito} />
    </div>
  );
}
