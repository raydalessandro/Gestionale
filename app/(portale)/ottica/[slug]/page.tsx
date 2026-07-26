import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { negozioDaSlug } from "@/lib/portale/negozio";
import { brandSicuro } from "@/lib/portale/brand";
import type { NegozioPubblicoRow } from "@/lib/database.types";
import { Btn, Eyebrow } from "@/components/portale/primitivi";
import { Icona } from "@/components/portale/Icone";
import { LogoLimpidia, SimboloLimpidia } from "@/components/portale/Marchio";

/**
 * Pagina pubblica del negozio (G4): /ottica/[slug]. Ci atterra il QR in vetrina.
 * Server component, nessuna interattività, nessun service role: legge solo la
 * vista `negozi_pubblici` con la chiave anon (vedi lib/portale/negozio.ts).
 *
 * In questa consegna NON si prenota: il motore (disponibilità/prenotazioni)
 * arriva in G6/G7 e si innesta qui. Vedi le due cuciture per il futuro:
 *  • `modalita` — oggi sempre "portale"; domani "sito_negozio" sarà QUESTA
 *    stessa pagina con gli elementi dell'aggregatore spenti;
 *  • il CTA di prenotazione — presente nella posizione definitiva, ma inerte.
 */

type Modalita = "portale" | "sito_negozio";

/** URL assoluto della pagina corrente, per canonical e JSON-LD. */
async function urlCanonico(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "limpidia.it";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/ottica/${slug}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const negozio = await negozioDaSlug(slug);
  if (!negozio) return { title: "Negozio non trovato" };

  const canonico = await urlCanonico(slug);
  const descrizione = negozio.tagline ?? `${negozio.nome_pubblico} — ottica`;
  return {
    title: negozio.nome_pubblico,
    description: descrizione,
    alternates: { canonical: canonico },
    robots: { index: true, follow: true },
    openGraph: {
      title: negozio.nome_pubblico,
      description: descrizione,
      url: canonico,
      type: "website",
    },
  };
}

/** Indirizzo su una riga, saltando i pezzi mancanti. */
function indirizzoInLinea(n: NegozioPubblicoRow): string | null {
  const riga1 = n.indirizzo?.trim() || null;
  const cittaPezzi = [n.cap?.trim(), n.citta?.trim()].filter(Boolean).join(" ");
  const prov = n.provincia?.trim() ? `(${n.provincia.trim()})` : "";
  const riga2 = [cittaPezzi, prov].filter(Boolean).join(" ") || null;
  return [riga1, riga2].filter(Boolean).join(" · ") || null;
}

export default async function PaginaNegozio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const negozio = await negozioDaSlug(slug);

  // Slug inesistente o negozio non pubblicato (la vista filtra portale_attivo):
  // 404 vera, non 500 e non pagina vuota. Per il pubblico quel negozio non esiste.
  if (!negozio) notFound();

  const brand = brandSicuro(negozio.brand);
  const modalita: Modalita = "portale"; // cucitura §8: domani anche "sito_negozio"
  const canonico = await urlCanonico(slug);
  const indirizzo = indirizzoInLinea(negozio);

  return (
    <div className="mx-auto min-h-screen max-w-[520px] pb-16">
      <JsonLdOptician negozio={negozio} url={canonico} indirizzo={indirizzo} />

      {/* Testata brandata col colore del negozio. brand.* è VALIDATO
          (lib/portale/brand.ts): solo qui, come colore inline, entra un valore
          dinamico — mai grezzo dal DB. */}
      <header
        className="px-5 pb-7 pt-8 text-white"
        style={{ backgroundColor: brand.primary }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/50 font-lim-display text-[22px] font-bold">
            {negozio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negozio.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              negozio.nome_pubblico.charAt(0)
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-lim-display text-2xl font-bold leading-tight">
              {negozio.nome_pubblico}
            </h1>
            {negozio.tagline && (
              <p className="mt-1 text-[13.5px] opacity-90">{negozio.tagline}</p>
            )}
          </div>
        </div>
      </header>

      <main className="px-5 pt-6">
        {/* CTA di prenotazione — posizione definitiva, ma INERTE (§8). Il motore
            di prenotazione arriva in G6/G7. */}
        <Btn full disabled>
          Prenotazione in arrivo
        </Btn>
        <p className="mb-7 mt-2.5 text-center text-[13px] text-lim-soft">
          Presto potrai prenotare un appuntamento da qui.
        </p>

        {/* Dove siamo */}
        {indirizzo && (
          <>
            <Eyebrow>Dove siamo</Eyebrow>
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-lim-linea bg-white p-[18px] text-[14.5px] text-lim-inchiostro">
              <span className="mt-0.5 text-lim-soft">
                <Icona nome="pin" size={19} />
              </span>
              <span className="leading-relaxed">{indirizzo}</span>
            </div>
          </>
        )}

        {/* Firma limpidia — solo in modalità aggregatore («portale»). Guest sul
            materiale del negozio: marchio MONOCROMATICO inchiostro, mai ambra. */}
        {modalita === "portale" && (
          <div className="flex flex-col items-center gap-2 pb-2 pt-2">
            <span className="inline-flex items-center gap-2 text-[11.5px] uppercase tracking-[0.04em] text-lim-faint">
              <SimboloLimpidia size={13} colore="#171512" /> Prenotazioni con
            </span>
            <LogoLimpidia width={104} testo="#171512" punti="#171512" />
          </div>
        )}
      </main>
    </div>
  );
}

/** Dati strutturati minimi: Optician con nome, indirizzo e URL canonico (§9). */
function JsonLdOptician({
  negozio,
  url,
  indirizzo,
}: {
  negozio: NegozioPubblicoRow;
  url: string;
  indirizzo: string | null;
}) {
  const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "IT" };
  if (negozio.indirizzo) address.streetAddress = negozio.indirizzo;
  if (negozio.citta) address.addressLocality = negozio.citta;
  if (negozio.cap) address.postalCode = negozio.cap;
  if (negozio.provincia) address.addressRegion = negozio.provincia;

  const dati = {
    "@context": "https://schema.org",
    "@type": "Optician",
    name: negozio.nome_pubblico,
    url,
    ...(negozio.tagline ? { description: negozio.tagline } : {}),
    ...(indirizzo ? { address } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify basta contro l'injection (niente </script> possibile
      // dai campi, sono testo semplice dalla vista pubblica).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dati) }}
    />
  );
}
