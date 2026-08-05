"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { MODULI } from "@/lib/modules";
import { Icona, type NomeIcona } from "@/components/Icone";

/**
 * Il guscio del gestionale — DS-01 §4.1, variante X3.
 *
 * Riallineato al prototipo `limpidia-oggi.html`, che ha cambiato due cose
 * rispetto alla prima passata e ha ragione su entrambe:
 *
 *  · **la colonna è bianca, non scura.** Al banco si sta davanti a questo
 *    schermo otto ore: una fascia scura alta quanto la finestra è un peso
 *    che si paga tutto il giorno. E su bianco la voce attiva può usare
 *    `ambra-50`/`ambra-700` (9.08), mentre su fondo scuro serviva `ambra-300`
 *    e l'ambra del marchio non si poteva usare affatto.
 *  · **la barra in cima non c'è più.** Ricerca e azioni sono scese nella
 *    colonna. Sparisce l'unica fascia orizzontale, e su un tablet in
 *    orizzontale l'altezza è la risorsa scarsa: sono 62px restituiti a ogni
 *    schermata.
 *
 * Regole da tablet, valide su ogni bersaglio: 48px minimi, 8px fra due, e
 * **nessuna etichetta rivelata dal passaggio del mouse** — l'hover non esiste.
 */

/* Sei moduli, non sette. **Clienti esce dalla colonna**: un cliente si
 * raggiunge cercando un cognome, mai scorrendo un elenco di quattromila.
 * Vive nella ricerca, che è il bersaglio subito sotto «Nuova busta».
 *
 * `lib/modules.ts` resta la fonte unica delle rotte — è fuori perimetro e
 * regge le guardie G7 e G9. Qui si decide solo la presentazione. */
const IN_COLONNA = ["dashboard", "ordini", "magazzino", "agenda", "richiami", "cassa"];

/** «Dashboard» è la parola di chi scrive software; «Oggi» è la parola di chi
 *  apre il gestionale alle nove per sapere cosa lo aspetta. Quando il registro
 *  verrà rinominato, questa mappa **si toglie, non si aggiorna**. */
const NOMI: Record<string, string> = { dashboard: "Oggi" };

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

/**
 * Il marchio: la retta interrotta dai due punti.
 * Nel logotipo vero i cinque punti sono i puntini delle lettere — la firma non
 * è un'astrazione applicata al marchio, era già dentro il marchio.
 */
function Marchio({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="7" viewBox="0 34 100 32" className={className} aria-hidden="true">
      <rect x="4" y="47.4" width="92" height="5.2" rx="2.6" fill="currentColor" />
      <circle cx="30" cy="50" r="15" fill="currentColor" />
      <circle cx="70" cy="50" r="15" fill="currentColor" />
    </svg>
  );
}

/**
 * La riga contestuale — «al banco ora: Marchetti Elena · BL-2026-0141».
 *
 * Non è una barra, è **una memoria**. Compare con una scheda aperta e sparisce
 * quando si chiude. Risolve il guasto più costoso del banco: il telefono che
 * squilla a metà di una busta, e quando riattacchi non sai più dov'eri.
 *
 * Sull'ambra, una nota onesta. La regola dice due ambre per schermata: azione
 * principale e voce attiva. Questa è la terza, ed è anche la superficie ambra
 * più grande dello schermo. Regge per un motivo solo: **non c'è quasi mai.**
 * Con nessuna scheda aperta le ambre restano due, e quando la riga compare è
 * perché è successo qualcosa che merita di essere la cosa più visibile della
 * pagina. Se al collaudo si scopre che sta su per mezza giornata, va spenta a
 * `neutro-100` — è una riga.
 */
export function RigaContestuale({
  chi,
  cosa,
  href,
  onChiudi,
}: {
  chi: string;
  cosa: string;
  href: string;
  onChiudi?: () => void;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3 border-b border-ambra-200 bg-ambra-50 px-5 py-2.5">
      {/* Colore pieno, non al 75% come nel prototipo: l'opacità portava
          l'etichetta a 4.82 su un corpo di 9.5px, e il pieno sta a 9.08.
          Non c'era niente da guadagnare a stare sul filo. */}
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-ambra-700">
        Al banco ora
      </span>
      <Link
        href={href}
        className="text-sm font-semibold text-ambra-700 underline underline-offset-2"
      >
        {chi}
      </Link>
      <span className="font-mono text-xs text-ambra-700">{cosa}</span>
      {onChiudi && (
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi la scheda"
          className="ml-auto grid h-9 w-9 place-content-center rounded text-ambra-700 transition-colors duration-scatto hover:bg-ambra-100"
        >
          <Icona nome="croce" size={16} />
        </button>
      )}
    </div>
  );
}

export default function Guscio({
  aziendaNome,
  utenteNome,
  contesto,
  children,
}: {
  aziendaNome: string;
  utenteNome: string;
  /** Lo slot della riga contestuale. Oggi il layout non lo passa: perché si
   *  accenda, ogni pagina di dettaglio deve dichiarare chi ha aperto, ed è
   *  logica dentro `app/(app)/**`. Vedi `dati-mancanti.md §4`. */
  contesto?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  /* F2 / F3 / F9 — restano attivi se c'è la tastiera agganciata. Non costano
   * spazio e regalano ai veterani di FOCUS l'unico pezzo di memoria muscolare
   * che conta. Ogni tasto ha il suo bersaglio scritto in chiaro lì accanto. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "F2" && e.key !== "F3" && e.key !== "F9") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      const dove =
        e.key === "F2"
          ? "/ordini/buste/nuova"
          : e.key === "F3"
            ? "/clienti"
            : "/cassa/vendita/nuova";
      window.location.href = dove;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const voci = IN_COLONNA.map((id) => MODULI.find((m) => m.id === id)).filter(
    (m): m is (typeof MODULI)[number] => Boolean(m)
  );

  const sigla = aziendaNome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-carta lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* ── La colonna ──────────────────────────────────────────────────
          Sotto i 1000px diventa una striscia orizzontale che scorre: su un
          telefono la colonna non ci sta, e mettere le voci dietro un panino
          significa nasconderle. */}
      <aside className="flex flex-none flex-row items-center gap-2 overflow-x-auto border-b border-linea bg-white px-2.5 py-2 lg:h-full lg:w-[212px] lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-2.5 lg:py-4">
        <Link
          href="/dashboard"
          className="mr-2 flex shrink-0 items-center gap-2 px-2 lg:mb-3.5 lg:mr-0"
        >
          <Marchio className="text-ambra-500" />
          <span className="f-serif text-[19px] font-semibold tracking-tight text-inchiostro">
            Limpidia
          </span>
        </Link>

        {/* L'azione grande sta nella colonna, la ricerca subito sotto. Non sono
            la stessa cosa: questa apre una lavorazione da quattrocento euro. */}
        <Link
          href="/ordini/buste/nuova"
          className="mb-0 flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded bg-ambra-500 px-3 text-[15px] font-semibold text-white transition-colors duration-scatto hover:bg-ambra-600 lg:mb-2.5 lg:min-h-[56px]"
        >
          <Icona nome="piu" size={20} />
          <span className="whitespace-nowrap">Nuova busta</span>
          <span className="hidden font-mono text-[10px] font-bold text-white/70 lg:inline">F2</span>
        </Link>

        <Link
          href="/clienti"
          className="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded border border-linea bg-carta px-3 text-left text-[13.5px] text-soft transition-colors duration-scatto hover:border-faint lg:mb-3"
        >
          <Icona nome="cerca" size={18} />
          <span className="whitespace-nowrap">Cerca cliente o busta</span>
          <span className="ml-auto hidden font-mono text-[10px] font-bold text-neutro-500 lg:inline">
            F3
          </span>
        </Link>

        <nav className="flex flex-row gap-2 lg:flex-1 lg:flex-col lg:gap-0.5">
          {voci.map((m) => {
            const attivo = pathname.startsWith(m.href);
            return (
              <Link
                key={m.id}
                href={m.href}
                aria-current={attivo ? "page" : undefined}
                className={`flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded px-3 text-[15px] transition-colors duration-scatto ${
                  attivo
                    ? "bg-ambra-50 font-semibold text-ambra-700"
                    : "text-inchiostro/[0.76] hover:bg-carta"
                }`}
              >
                <Icona nome={ICONE[m.icona]} size={21} />
                <span className="flex-1">{NOMI[m.id] ?? m.nome}</span>
                {/* Il marcatore della voce attiva è il marchio stesso. */}
                {attivo && <Marchio className="shrink-0" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 lg:mt-2.5 lg:block lg:border-t lg:border-linea lg:pt-3">
          <div className="hidden items-center gap-2.5 px-1 lg:flex">
            <span className="grid h-9 w-9 flex-none place-content-center rounded border border-linea bg-carta font-mono text-[11px] font-semibold text-inchiostro">
              {sigla || "··"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-inchiostro">
                {aziendaNome}
              </span>
              <span className="block truncate text-[11px] text-soft">{utenteNome}</span>
            </span>
          </div>
          <form action="/auth/signout" method="post" className="lg:mt-1">
            <button
              type="submit"
              className="flex min-h-[44px] items-center gap-2.5 rounded px-3 text-[12.5px] text-soft transition-colors duration-scatto hover:bg-carta"
            >
              <Icona nome="esci" size={15} />
              <span className="hidden lg:inline">Esci</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        {contesto}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:overflow-y-auto lg:px-5 lg:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
