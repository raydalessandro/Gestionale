import { notFound } from "next/navigation";
import { negozioDaSlug, serviziDaSlug } from "@/lib/portale/negozio";
import WizardPrenota from "./WizardPrenota";

/**
 * Percorso di prenotazione (G7): /ottica/[slug]/prenota. Si arriva SEMPRE da un
 * negozio (l'aggregatore è spento). Il passo «scegli il negozio» non esiste.
 * Server component: risolve il negozio e i servizi, poi monta il percorso client.
 */
export const dynamic = "force-dynamic";

export default async function PrenotaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ da?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const negozio = await negozioDaSlug(slug);
  if (!negozio) notFound();

  const servizi = await serviziDaSlug(slug);
  const da = typeof sp.da === "string" ? sp.da : null;

  return (
    <WizardPrenota
      slug={slug}
      nomeNegozio={negozio.nome_pubblico}
      servizi={servizi}
      da={da}
    />
  );
}
