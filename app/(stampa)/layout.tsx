import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Layout dedicato alla stampa: nessuna sidebar, sfondo bianco. */
export default async function StampaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
