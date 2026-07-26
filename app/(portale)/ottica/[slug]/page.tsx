import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  negozioDaSlug,
  orariDaSlug,
  chiusureDaSlug,
  serviziDaSlug,
} from "@/lib/portale/negozio";
import { brandSicuro, testoSuFondo } from "@/lib/portale/brand";
import {
  raggruppaOrari,
  statoApertura,
  dataItaliana,
  oggiISO,
  giornoRelativo,
  etichettaGiorno,
  oraDaISO,
  type RigaOrario,
} from "@/lib/portale/orari";
import { slotLiberi } from "@/lib/portale/slot";
import type {
  NegozioPubblicoRow,
  OrarioPubblicoRow,
  ServizioPubblicoRow,
} from "@/lib/database.types";
import { Btn, Eyebrow } from "@/components/portale/primitivi";
import { Icona } from "@/components/portale/Icone";
import { LogoLimpidia, SimboloLimpidia } from "@/components/portale/Marchio";

/**
 * Pagina pubblica del negozio: /ottica/[slug]. Ci atterra il QR in vetrina.
 * Server component, nessuna interattività, nessun service role: legge solo le
 * viste pubbliche con la chiave anon (vedi lib/portale/negozio.ts).
 *
 * G4: chi è, dov'è. G5: quando è aperto e cosa fa — le due domande per cui una
 * persona apre la pagina dopo un QR alle nove di sera. NON si prenota ancora
 * (motore in G6/G7): il CTA resta inerte.
 */

// force-dynamic: l'indicatore «Aperto ora» è calcolato in ora corrente; una
// pagina statica lo congelerebbe al momento della build. Oggi la correttezza
// vale più di qualche millisecondo — la strategia di cache si rivede col traffico.
export const dynamic = "force-dynamic";

type Modalita = "portale" | "sito_negozio";

// Nomi giorno di schema.org, indicizzati per `giorno` (0=domenica … 6=sabato).
const GIORNI_SCHEMA = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servizio?: string; giorno?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const negozio = await negozioDaSlug(slug);

  // Slug inesistente o negozio non pubblicato (le viste filtrano portale_attivo):
  // 404 vera, non 500 e non pagina vuota. Per il pubblico quel negozio non esiste.
  if (!negozio) notFound();

  // Le tre letture di vetrina sono indipendenti: in parallelo.
  const [orari, chiusure, servizi] = await Promise.all([
    orariDaSlug(slug),
    chiusureDaSlug(slug),
    serviziDaSlug(slug),
  ]);

  const brand = brandSicuro(negozio.brand);
  // Contrasto della testata: aritmetica, non estetica. Il testo (e quindi bordi
  // e sfumature che ne seguono il colore) si sceglie per leggibilità sul primary.
  const testo = testoSuFondo(brand.primary);
  const modalita: Modalita = "portale"; // cucitura §8: domani anche "sito_negozio"
  const canonico = await urlCanonico(slug);
  const indirizzo = indirizzoInLinea(negozio);

  const stato = statoApertura(orari, chiusure, new Date());
  const righeOrario = raggruppaOrari(orari);
  const haOrari = orari.length > 0;

  // ── Slot liberi (G6) ── servizio e giorno si scelgono via query (link, no JS).
  const oggi = oggiISO(new Date());
  const giorno = typeof sp.giorno === "string" && sp.giorno >= oggi ? sp.giorno : oggi;
  const servizioSel = servizi.find((s) => s.codice === sp.servizio) ?? null;
  const slots = servizioSel ? await slotLiberi(slug, servizioSel.codice, giorno) : [];

  return (
    <div className="mx-auto min-h-screen max-w-[520px] pb-16">
      <JsonLdOptician
        negozio={negozio}
        url={canonico}
        indirizzo={indirizzo}
        orari={orari}
        servizi={servizi}
      />

      {/* Testata brandata. brand.primary è VALIDATO; `testo` (inchiostro o bianco)
          è scelto per contrasto e guida anche il bordo del tondo e la tagline. */}
      <header
        className="px-5 pb-7 pt-8"
        style={{ backgroundColor: brand.primary, color: testo }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 font-lim-display text-[22px] font-bold"
            style={{ borderColor: `${testo}80` }}
          >
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
        {/* Aperto ora / Chiuso — calcolato in ora italiana, tenuto conto delle ferie. */}
        <StatoApertura stato={stato} />

        {/* CTA di prenotazione — posizione definitiva, ma INERTE (§8, G6/G7). */}
        <Btn full disabled>
          Prenotazione in arrivo
        </Btn>
        <p className="mb-7 mt-2.5 text-center text-[13px] text-lim-soft">
          Presto potrai prenotare un appuntamento da qui.
        </p>

        {/* Servizi attivi, nell'ordine del catalogo. Nessun prezzo: non li abbiamo. */}
        {servizi.length > 0 && (
          <>
            <Eyebrow>Servizi</Eyebrow>
            <div className="mb-6 overflow-hidden rounded-2xl border border-lim-linea bg-white">
              {servizi.map((s, i) => (
                <div
                  key={s.codice}
                  className={`flex items-center justify-between gap-3 px-[18px] py-4 ${
                    i < servizi.length - 1 ? "border-b border-lim-linea" : ""
                  }`}
                >
                  <span className="text-[15.5px] font-semibold text-lim-inchiostro">
                    {s.etichetta}
                  </span>
                  <span className="shrink-0 text-[13px] text-lim-soft">{s.durata_minuti} min</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Orari liberi (G6). Servizio e giorno si scelgono con dei link
            (?servizio / ?giorno): nessun componente client, tutta navigazione
            server. In sola lettura: il percorso guidato di prenotazione è G7. */}
        {servizi.length > 0 && (
          <SezioneSlot
            servizi={servizi}
            servizioSel={servizioSel}
            giorno={giorno}
            oggi={oggi}
            slots={slots}
          />
        )}

        {/* Orari raggruppati come li legge una persona. */}
        {haOrari && (
          <>
            <Eyebrow>Orari di apertura</Eyebrow>
            <div className="mb-6 rounded-2xl border border-lim-linea bg-white p-[18px]">
              <div className="mb-3 flex items-center gap-3 text-lim-soft">
                <Icona nome="orologio" size={19} />
                <span className="text-[13px] font-semibold uppercase tracking-wide">
                  La settimana
                </span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14.5px]">
                {righeOrario.map((r: RigaOrario) => (
                  <div key={r.giorni} className="contents">
                    <dt className="font-semibold text-lim-inchiostro">{r.giorni}</dt>
                    <dd
                      className={`text-right ${
                        r.orario === "Chiuso" ? "text-lim-faint" : "text-lim-soft"
                      }`}
                    >
                      {r.orario}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}

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

/**
 * Griglia degli orari liberi (G6). Servizio e giorno via query-string (link,
 * navigazione server, zero JavaScript). Gli slot sono in SOLA LETTURA: il
 * percorso guidato di prenotazione arriva in G7.
 */
function SezioneSlot({
  servizi,
  servizioSel,
  giorno,
  oggi,
  slots,
}: {
  servizi: ServizioPubblicoRow[];
  servizioSel: ServizioPubblicoRow | null;
  giorno: string;
  oggi: string;
  slots: string[];
}) {
  const q = (servizio: string, g: string) =>
    `?servizio=${encodeURIComponent(servizio)}&giorno=${g}`;
  const navCls =
    "flex h-9 w-9 items-center justify-center rounded-full border border-lim-linea bg-white text-lim-inchiostro";

  return (
    <section className="mb-6">
      <Eyebrow>Prenota un servizio</Eyebrow>
      <div className="mb-4 flex flex-wrap gap-2">
        {servizi.map((s) => {
          const sel = servizioSel?.codice === s.codice;
          return (
            <a
              key={s.codice}
              href={q(s.codice, giorno)}
              className={`rounded-xl border px-3 py-2 text-[13.5px] font-semibold ${
                sel
                  ? "border-lim-inchiostro bg-lim-inchiostro text-white"
                  : "border-lim-linea bg-white text-lim-inchiostro"
              }`}
            >
              {s.etichetta}
            </a>
          );
        })}
      </div>

      {servizioSel && (
        <div className="rounded-2xl border border-lim-linea bg-white p-[18px]">
          <div className="mb-4 flex items-center justify-between gap-2">
            {giorno > oggi ? (
              <a href={q(servizioSel.codice, giornoRelativo(giorno, -1))} className={navCls} aria-label="Giorno precedente">
                ‹
              </a>
            ) : (
              <span className="h-9 w-9" aria-hidden="true" />
            )}
            <span className="text-[14.5px] font-semibold capitalize text-lim-inchiostro">
              {etichettaGiorno(giorno)}
            </span>
            <a href={q(servizioSel.codice, giornoRelativo(giorno, 1))} className={navCls} aria-label="Giorno successivo">
              ›
            </a>
          </div>

          {slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((iso) => (
                <span
                  key={iso}
                  className="rounded-xl border border-lim-linea bg-lim-carta px-2 py-2.5 text-center text-[14px] font-semibold tabular-nums text-lim-inchiostro"
                >
                  {oraDaISO(iso)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-lim-soft">
              Nessun orario libero {etichettaGiorno(giorno)}.{" "}
              <a
                href={q(servizioSel.codice, giornoRelativo(giorno, 1))}
                className="font-semibold text-lim-ambra underline"
              >
                Prova {etichettaGiorno(giornoRelativo(giorno, 1))}
              </a>
              .
            </p>
          )}

          <p className="mt-4 text-center text-[12.5px] text-lim-faint">
            Orari in sola lettura — la prenotazione arriva a breve.
          </p>
        </div>
      )}
    </section>
  );
}

/** Indicatore «Aperto ora / Chiuso», con eventuale nota di chiusura per ferie. */
function StatoApertura({
  stato,
}: {
  stato: { aperto: boolean; feriaAlISO: string | null };
}) {
  if (stato.feriaAlISO) {
    return (
      <div className="mb-4 flex items-center gap-2.5 text-[14px]">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lim-faint" />
        <span className="font-semibold text-lim-soft">
          Chiuso per ferie fino al {dataItaliana(stato.feriaAlISO)}
        </span>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-center gap-2.5 text-[14px]">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: stato.aperto ? "#1E7A52" : "#8B877F" }}
      />
      <span
        className="font-semibold"
        style={{ color: stato.aperto ? "#1E7A52" : "#6E6A64" }}
      >
        {stato.aperto ? "Aperto ora" : "Chiuso ora"}
      </span>
    </div>
  );
}

/**
 * Dati strutturati: Optician con nome, indirizzo, URL, orari veri
 * (openingHoursSpecification) e servizi (hasOfferCatalog). Le chiusure
 * straordinarie NON entrano nei dati strutturati.
 */
function JsonLdOptician({
  negozio,
  url,
  indirizzo,
  orari,
  servizi,
}: {
  negozio: NegozioPubblicoRow;
  url: string;
  indirizzo: string | null;
  orari: OrarioPubblicoRow[];
  servizi: ServizioPubblicoRow[];
}) {
  const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "IT" };
  if (negozio.indirizzo) address.streetAddress = negozio.indirizzo;
  if (negozio.citta) address.addressLocality = negozio.citta;
  if (negozio.cap) address.postalCode = negozio.cap;
  if (negozio.provincia) address.addressRegion = negozio.provincia;

  const opening = orari.map((o) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: GIORNI_SCHEMA[o.giorno],
    opens: o.apre.slice(0, 5),
    closes: o.chiude.slice(0, 5),
  }));

  const dati = {
    "@context": "https://schema.org",
    "@type": "Optician",
    name: negozio.nome_pubblico,
    url,
    ...(negozio.tagline ? { description: negozio.tagline } : {}),
    ...(indirizzo ? { address } : {}),
    ...(opening.length ? { openingHoursSpecification: opening } : {}),
    ...(servizi.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Servizi",
            itemListElement: servizi.map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: s.etichetta },
            })),
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dati) }}
    />
  );
}
