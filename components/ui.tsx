import Link from "next/link";
import type { ReactNode } from "react";
import type { Fonte } from "@/lib/database.types";

/**
 * Primitivi Limpidia — pelle «Carta + Netta».
 *
 * Sostituisce l'aspetto, NON l'interfaccia: ogni export mantiene la firma
 * di prima, perché 50 file importano da qui. Le aggiunte sono in fondo.
 *
 * Cosa cambia a vista:
 *   · spigoli a 5px ovunque (erano 12–16). Strumento, non applicazione.
 *   · niente ombre: su carta tinta le schede bianche si sollevano da sole.
 *   · l'ottone diventa ambra-500, il colore del marchio.
 *   · il fondo pagina è tinto, le superfici restano bianche: è il
 *     meccanismo che fa risaltare il dato senza aggiungere peso.
 *
 * Regola che vale ovunque qui dentro: l'ambra è l'AZIONE. Non è mai
 * uno stato. Se ti serve colorare uno stato, usa verde/blu/rosso.
 */

/* ── Superfici ─────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded border border-linea bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  titolo,
  sotto,
  azione,
}: {
  titolo: string;
  sotto?: string;
  azione?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="f-serif text-2xl font-semibold tracking-tight text-inchiostro md:text-3xl">
          {titolo}
        </h1>
        {sotto && <p className="mt-1 text-sm text-soft">{sotto}</p>}
      </div>
      {azione}
    </div>
  );
}

/* ── Azioni ────────────────────────────────────────────────────────── */

// min-h-[44px]: la postazione è un tablet, il dito non centra sotto i 44.
const btnBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition-colors duration-scatto disabled:cursor-not-allowed disabled:opacity-50";

const btnVarianti = {
  primary: "bg-inchiostro text-carta hover:bg-black",
  accent: "bg-ambra-500 text-white hover:bg-ambra-600",
  ghost:
    "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta",
} as const;

export function Button({
  children,
  variante = "primary",
  type = "button",
  disabled,
  className = "",
  onClick,
}: {
  children: ReactNode;
  variante?: keyof typeof btnVarianti;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  /** Aggiunta col ramo 5. Nessuna firma è stata tolta: questa è in più, ed è
   *  facoltativa, quindi i cinquanta chiamanti esistenti non se ne accorgono.
   *  Serviva perché senza `onClick` un componente client non può usare
   *  `Button` — e infatti oggi non lo usa nessuno: AzioniAgenda, AzioniOrdine
   *  e gli altri si riscrivono le classi del pulsante a mano, ciascuno le sue.
   *  Quello è il vero costo, e questa prop è il primo passo per toglierlo. */
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${btnBase} ${btnVarianti[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variante = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variante?: keyof typeof btnVarianti;
  className?: string;
}) {
  return (
    <Link href={href} className={`${btnBase} ${btnVarianti[variante]} ${className}`}>
      {children}
    </Link>
  );
}

/* ── Form ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

// min-h-[44px] anche qui: da tablet un campo basso non si centra.
export const inputCls =
  "w-full min-h-[44px] rounded border border-linea bg-white px-3.5 py-2.5 text-base text-inchiostro placeholder:text-faint focus:border-ambra-500 focus:outline-none focus:ring-2 focus:ring-ambra-100";

export function Errore({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  // Filetto a sinistra invece del bordo tutto attorno: un errore si legge
  // per primo, e il filetto lo fa senza chiudere il testo in una scatola.
  return (
    <div className="rounded-r border-l-[3px] border-rosso-600 bg-rosso-50 px-4 py-3 text-sm text-inchiostro">
      {msg}
    </div>
  );
}

/* ── Badge stato/fonte ─────────────────────────────────────────────── */

const badgeTinte = {
  verde: "bg-verde-100 text-verde-700",
  blu: "bg-blu-100 text-blu-700",
  rosso: "bg-rosso-100 text-rosso-700",
  neutro: "bg-neutro-100 text-neutro-600",
  /** @deprecated resta per compatibilità: `ambra` non è più uno stato.
   *  Vive solo come marca di provenienza (fonte), mai come fase di pipeline. */
  ambra: "bg-ambra-50 text-ambra-700",
  /** @deprecated alias storico dell'ottone. Punta all'ambra del marchio. */
  ottone: "bg-ambra-50 text-ambra-700",
} as const;

export function Badge({
  children,
  tinta = "neutro",
}: {
  children: ReactNode;
  tinta?: keyof typeof badgeTinte;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeTinte[tinta]}`}
    >
      {children}
    </span>
  );
}

/** Tinta del badge per ogni fonte. Deriva dal vocabolario unico: se aggiungi
 *  una fonte a FONTI e scordi la tinta, TypeScript qui non compila. L'input è
 *  tollerante (una fonte sconosciuta a runtime cade su "neutro").
 *
 *  Scelta: le fonti sono PROVENIENZE, non stati. Restano quasi tutte neutre —
 *  in un elenco di trenta buste trenta pastiglie colorate sono rumore. Solo
 *  quelle che arrivano dal canale Limpidia portano l'ambra, perché lì la
 *  pastiglia dice «questa te l'abbiamo portata noi», ed è l'unica volta in cui
 *  l'ambra come provenienza vale il suo prezzo. */
const TINTE_FONTE: Record<Fonte, keyof typeof badgeTinte> = {
  banco: "neutro",
  app: "ambra",
  convenzione: "neutro",
  import: "neutro",
  qr_vetrina: "ambra",
  sito_negozio: "ambra",
  portale: "ambra",
};

export function tintaFonte(fonte: string): keyof typeof badgeTinte {
  return TINTE_FONTE[fonte as Fonte] ?? "neutro";
}

/* ── Vuoti ─────────────────────────────────────────────────────────── */

export function Vuoto({
  titolo,
  testo,
  azione,
  figura,
}: {
  titolo: string;
  testo?: string;
  azione?: ReactNode;
  /** Figura vuota. Se manca, lo spazio non viene occupato: uno schermo
   *  vuoto non va decorato per forza. */
  figura?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 text-center">
      {figura && <div className="mb-4 h-24 w-24 text-faint">{figura}</div>}
      <p className="f-serif text-lg text-inchiostro">{titolo}</p>
      {testo && <p className="max-w-sm text-sm text-soft">{testo}</p>}
      {azione && <div className="mt-3">{azione}</div>}
    </Card>
  );
}

/* ══ AGGIUNTE ══════════════════════════════════════════════════════ */

/* ── Elenchi ───────────────────────────────────────────────────────
 * La riga «Scavato»: bianca su carta tinta, nessun bordo attorno, solo
 * il filetto che separa. Le righe si staccano dal fondo da sole, senza
 * ombre e senza scatole — è quello che regge trenta righe senza rumore.
 */

export function Elenco({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded border border-linea bg-white ${className}`}>
      {children}
    </div>
  );
}

export function Riga({
  codice,
  titolo,
  dettaglio,
  stato,
  azione,
}: {
  /** Numerazione in mono: si legge in colonna e si confronta. */
  codice?: string;
  titolo: ReactNode;
  dettaglio?: ReactNode;
  /** Sempre a destra, in ogni larghezza: è l'unica cosa che si cerca da
   *  lontano e non deve mai cambiare posto. */
  stato?: ReactNode;
  azione?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-linea px-4 py-3 first:border-t-0 hover:bg-carta">
      <div className="min-w-0 flex-1">
        {codice && (
          <div className="font-mono text-[11px] tracking-wide text-soft">{codice}</div>
        )}
        <div className="truncate font-semibold text-inchiostro">{titolo}</div>
        {dettaglio && <div className="truncate text-xs text-soft">{dettaglio}</div>}
      </div>
      {stato}
      {azione}
    </div>
  );
}

/* ── Tendina ───────────────────────────────────────────────────────
 * Apre in 110 ms, sola opacità, nessun teatro: al banco si apre quaranta
 * volte al giorno e deve essere già lì. La messa a fuoco (240 ms) è la
 * firma del portale, non del gestionale.
 *
 * Componente non controllato: l'apertura la gestisce chi la usa con
 * `aperta`, così resta utilizzabile anche da server component.
 */

export function Tendina({
  aperta,
  children,
  className = "",
}: {
  aperta: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded border border-linea bg-white shadow-[0_8px_22px_rgba(18,16,15,0.10)] transition-opacity duration-scatto ${
        aperta ? "visible opacity-100" : "invisible opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function VoceTendina({
  children,
  scelta = false,
  onClick,
}: {
  children: ReactNode;
  scelta?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] w-full items-center gap-2.5 border-t border-linea px-3.5 text-left text-sm first:border-t-0 ${
        scelta ? "bg-ambra-50 font-semibold text-ambra-700" : "text-inchiostro hover:bg-carta"
      }`}
    >
      {/* Il segnaposto della voce scelta sono i due punti del marchio,
          non una spunta: è l'unico posto della tendina dove la firma serve. */}
      <span className="w-[18px] shrink-0">
        {scelta && (
          <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
            <circle cx="5" cy="4" r="2.6" fill="currentColor" />
            <circle cx="13" cy="4" r="2.6" fill="currentColor" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

/* ── Filetto ───────────────────────────────────────────────────────
 * Separatore di sezione: la retta interrotta dai due punti del marchio.
 */

export function Filetto({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-linea" />
      <svg width="30" height="6" viewBox="0 0 30 6" className="text-ambra-500">
        <line x1="2" y1="3" x2="28" y2="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="11" cy="3" r="2.6" fill="currentColor" />
        <circle cx="19" cy="3" r="2.6" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-linea" />
    </div>
  );
}
