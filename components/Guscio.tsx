"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { MODULI } from "@/lib/modules";
import { Icona, type NomeIcona } from "@/components/Icone";

/**
 * Il guscio del gestionale — variante X3 di DS-01 §4.1.
 *
 * Sostituisce `Sidebar.tsx`. Tre pezzi:
 *   · la colonna scura a sinistra, 212px, sei voci e un'azione grande;
 *   · la barra chiara in cima all'area di contenuto: ricerca e due azioni piccole;
 *   · lo spazio della riga contestuale, che oggi resta vuoto (vedi in fondo).
 *
 * Da dove viene la forma. La postazione è un tablet in orizzontale: larghezza
 * in abbondanza, altezza scarsa. Quindi **la colonna costa poco e ogni fascia
 * orizzontale costa il doppio** — di fasce ce n'è una sola, e non porta numeri.
 * I numeri della giornata vivono dentro «Oggi», dove si va a leggerli.
 *
 * Le regole da tablet, che valgono su ogni bersaglio qui dentro:
 *   · 48px minimi (non 44: qui si preme in piedi, con il cliente davanti);
 *   · 8px fra due bersagli;
 *   · **nessuna etichetta rivelata dal passaggio del mouse.** L'hover non
 *     esiste su un tablet: la parola o è scritta o non c'è.
 *
 * Posizione fissa e parola sempre scritta. Il veterano di FOCUS punta a
 * memoria, la nuova assunta legge, e la parola non rallenta chi non la legge:
 * è l'unico punto del sistema in cui servire due pubblici non costa niente.
 */

/* ── Cosa sta nella colonna, e cosa no ────────────────────────────────────
 * Sei moduli, non sette. **Clienti esce dalla colonna**: un cliente si
 * raggiunge cercando un cognome, mai scorrendo un elenco di quattromila. Vive
 * nella ricerca e nel pulsante «Trova cliente», che sono due gesti veri.
 *
 * `lib/modules.ts` resta la fonte unica delle rotte — è fuori dal perimetro
 * del design e non l'ho toccato. Qui si decide solo *come si presenta*: quali
 * voci vanno nella colonna, con che nome e con che icona. Se un domani il
 * registro cambia nome a «Dashboard», questa mappa va tolta, non aggiornata.
 */
const IN_COLONNA = ["dashboard", "ordini", "magazzino", "agenda", "richiami", "cassa"];

/** Nome mostrato quando è diverso da quello del registro.
 *  «Dashboard» è la parola di chi scrive software; «Oggi» è la parola di chi
 *  apre il gestionale alle nove per sapere cosa lo aspetta. */
const NOMI: Record<string, string> = { dashboard: "Oggi", ordini: "Ordini" };

const ICONE: Record<string, NomeIcona> = {
  dashboard: "dashboard",
  clienti: "clienti",
  prescrizioni: "prescrizione",
  ordini: "ordini",
  magazzino: "magazzino",
  agenda: "agenda",
  richiami: "richiami",
  cassa: "cassa",
};

/* ── I due punti del marchio ───────────────────────────────────────────────
 * Marcano la voce attiva, e sono la stessa firma della tendina e del filetto.
 * Nel logotipo vero i cinque punti sono i puntini delle lettere: la firma non
 * è un'astrazione applicata al marchio, era già dentro il marchio.
 *
 * Su fondo scuro l'ambra del marchio non si usa: `#B4551A` su `#12100F` fa
 * 3.84, sotto soglia. Qui e nel logotipo sta `ambra-300`, che fa 9.51.
 */
function DuePunti({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="6" viewBox="0 0 14 6" className={className} aria-hidden="true">
      <circle cx="3" cy="3" r="2.4" fill="currentColor" />
      <circle cx="11" cy="3" r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function Guscio({
  aziendaNome,
  utenteNome,
  children,
}: {
  aziendaNome: string;
  utenteNome: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const cerca = useRef<HTMLInputElement>(null);

  /* F2 / F3 / F9 — restano attivi se c'è la tastiera agganciata.
   * Non costano spazio e regalano ai veterani di FOCUS l'unico pezzo di
   * memoria muscolare che conta davvero. Non sostituiscono niente: ogni tasto
   * ha il suo bersaglio scritto in chiaro a due centimetri di distanza. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "F2" && e.key !== "F3" && e.key !== "F9") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (e.key === "F3") return cerca.current?.focus();
      const dove = e.key === "F2" ? "/ordini/buste/nuova" : "/cassa/vendita/nuova";
      window.location.href = dove;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const voci = IN_COLONNA.map((id) => MODULI.find((m) => m.id === id)).filter(
    (m): m is (typeof MODULI)[number] => Boolean(m)
  );

  return (
    <div className="flex min-h-screen flex-col bg-carta md:flex-row">
      {/* ── La colonna ────────────────────────────────────────────────────
          Sotto i 768px diventa una striscia orizzontale che scorre: su un
          telefono la colonna non ci sta, e nascondere le voci dietro un
          panino significa nasconderle. */}
      <aside className="flex shrink-0 flex-row items-center gap-2 overflow-x-auto bg-neutro-950 px-3 py-2 text-carta md:h-screen md:w-[212px] md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:px-3 md:py-5">
        <Link
          href="/dashboard"
          className="mr-2 flex shrink-0 items-center gap-1.5 px-1 md:mb-5 md:mr-0"
        >
          <span className="f-serif text-[19px] font-semibold lowercase tracking-tight">
            limpidia
          </span>
          <DuePunti className="text-ambra-300" />
        </Link>

        {/* L'azione grande sta nella colonna, le due piccole stanno accanto
            alla ricerca. Non sono la stessa cosa: questa apre una lavorazione
            da quattrocento euro, quelle battono uno scontrino da dodici. */}
        <Link
          href="/ordini/buste/nuova"
          className="hidden min-h-[48px] items-center justify-center gap-2 rounded bg-ambra-500 px-3 text-sm font-semibold text-white transition-colors duration-scatto hover:bg-ambra-600 md:mb-5 md:flex"
        >
          <Icona nome="piu" size={17} />
          Nuova busta
          <span className="font-mono text-[10px] font-bold text-white/60">F2</span>
        </Link>

        <nav className="flex flex-row gap-2 md:flex-1 md:flex-col md:gap-1">
          {voci.map((m) => {
            const attivo = pathname.startsWith(m.href);
            return (
              <Link
                key={m.id}
                href={m.href}
                aria-current={attivo ? "page" : undefined}
                className={`flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded px-2.5 text-sm transition-colors duration-scatto ${
                  attivo
                    ? "bg-white/10 font-semibold text-carta"
                    : "text-carta/70 hover:bg-white/5 hover:text-carta"
                }`}
              >
                <Icona nome={ICONE[m.icona]} size={19} />
                <span className="flex-1">{NOMI[m.id] ?? m.nome}</span>
                {/* Il marcatore è a destra e non a sinistra: a sinistra ci
                    sono le icone, e due segni sullo stesso bordo si leggono
                    come uno solo. */}
                {attivo && <DuePunti className="text-ambra-300" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:mt-5 md:block md:border-t md:border-white/10 md:pt-4">
          <div className="hidden md:block">
            <p className="truncate text-sm font-semibold">{aziendaNome}</p>
            <p className="truncate text-xs text-carta/50">{utenteNome}</p>
          </div>
          <form action="/auth/signout" method="post" className="md:mt-2">
            <button
              type="submit"
              className="flex min-h-[48px] items-center gap-2 rounded px-2.5 text-xs text-carta/60 transition-colors duration-scatto hover:bg-white/5 hover:text-carta"
            >
              <Icona nome="esci" size={16} />
              <span className="hidden md:inline">Esci</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── La barra ──────────────────────────────────────────────────
            Una fascia sola, e non porta numeri: i numeri stanno in «Oggi».
            La ricerca è un `form` GET verso l'elenco clienti, così funziona
            anche senza JavaScript e la porta dell'archivio resta aperta. */}
        <header className="flex flex-wrap items-center gap-2 border-b border-linea bg-white px-4 py-2.5 md:px-6">
          <form action="/clienti" className="relative min-w-0 flex-1 md:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
              <Icona nome="cerca" size={17} />
            </span>
            <input
              ref={cerca}
              name="q"
              type="search"
              placeholder="Cerca un cognome…"
              aria-label="Cerca un cliente"
              className="min-h-[44px] w-full rounded border border-linea bg-carta pl-10 pr-12 text-base text-inchiostro placeholder:text-faint focus:border-ambra-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ambra-100"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] font-bold text-faint md:block"
            >
              F3
            </span>
          </form>

          <div className="flex items-center gap-2">
            <Link
              href="/clienti"
              className="inline-flex min-h-[44px] items-center gap-2 rounded border border-linea bg-white px-3 text-sm font-semibold text-inchiostro transition-colors duration-scatto hover:bg-carta"
            >
              <Icona nome="clienti" size={16} />
              <span className="hidden sm:inline">Trova cliente</span>
            </Link>
            <Link
              href="/cassa/vendita/nuova"
              className="inline-flex min-h-[44px] items-center gap-2 rounded border border-linea bg-white px-3 text-sm font-semibold text-inchiostro transition-colors duration-scatto hover:bg-carta"
            >
              <Icona nome="scontrino" size={16} />
              <span className="hidden sm:inline">Vendita</span>
              <span className="hidden font-mono text-[10px] font-bold text-faint md:inline">F9</span>
            </Link>
          </div>

          {/* Su telefono la «Nuova busta» non sta nella colonna (che è
              diventata una striscia): sta qui, ed è l'unica ambra della barra. */}
          <Link
            href="/ordini/buste/nuova"
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-ambra-500 px-3 text-sm font-semibold text-white md:hidden"
          >
            <Icona nome="piu" size={16} />
            Busta
          </Link>
        </header>

        {/* ── Lo spazio della riga contestuale ──────────────────────────
            Qui va «al banco ora: Marchetti Elena · BL-2026-0141», che
            compare con una scheda aperta e sparisce quando si chiude —
            risolve il guasto più costoso del banco, il telefono che squilla
            a metà di una busta.
            **Non è in questo ramo, e resta vuoto.** Non per mancanza di
            disegno: perché ogni pagina di dettaglio deve dire chi ha aperto,
            e quella è una riga di logica dentro `app/(app)/**`, fuori dal
            perimetro. La forma del dato e il punto d'innesto sono in
            docs/design/dati-mancanti.md §4. */}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
