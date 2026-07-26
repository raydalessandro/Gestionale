import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoLimpidia } from "@/components/portale/Marchio";

/**
 * La radice del dominio (Checkpoint). Chi digita l'indirizzo di Limpidia non deve
 * cadere sul modulo di accesso di un gestionale:
 *   • con sessione → /dashboard, come prima;
 *   • senza sessione → questa landing pubblica, nel marchio Limpidia.
 *
 * Vive nel gruppo di rotte del portale (font Gabarito/Figtree, robots index).
 * Volutamente scarna e onesta: NIENTE elenco di negozi, NIENTE ricerca per zona,
 * NIENTE cifre inventate — l'aggregatore è spento per decisione, e una pagina che
 * promette una ricerca inesistente è peggio di una pagina scarna. La landing vera
 * per gli ottici è un lavoro a parte.
 */
export const metadata: Metadata = {
  title: "Limpidia — prenotazioni per la tua ottica",
  description:
    "Limpidia collega chi cerca un ottico al negozio di fiducia. Sei un ottico? Accedi al gestionale.",
  robots: { index: true, follow: true },
};

export default async function Radice() {
  // Gate leggero: leggo la sessione solo per decidere il redirect, non per
  // mostrare dati riservati (il portale resta senza chrome del gestionale).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-center px-6 py-16 text-center">
      <LogoLimpidia width={168} />
      <p className="mt-8 text-[17px] leading-relaxed text-lim-inchiostro">
        Limpidia collega chi cerca un ottico al suo negozio di fiducia — orari,
        servizi e la prenotazione, in un minuto.
      </p>
      <p className="mt-3 text-[14px] text-lim-soft">
        Ci si arriva dal QR in vetrina del tuo ottico.
      </p>

      <Link
        href="/login"
        className="mt-10 inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-lim-linea bg-white px-6 py-3 text-[15px] font-semibold text-lim-inchiostro"
      >
        Sei un ottico? Accedi
      </Link>
    </main>
  );
}
