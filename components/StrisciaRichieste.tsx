import Link from "next/link";
import { oraDi } from "@/components/AgendaUI";

/**
 * La striscia delle richieste in sospeso (G8), sopra la navigazione.
 *
 * Era un blocco inline dentro `app/(app)/agenda/page.tsx` con i colori
 * dell'ottone. Qui diventa un componente, così la pagina si ristiliza
 * sostituendo un blocco con un tag e non riscrivendo la pagina.
 *
 * Perché verde e non ottone. Nel codice di prima c'era scritto che l'ottone
 * serviva «per saltare all'occhio». Nel sistema nuovo l'ottone non esiste
 * più, e una richiesta in attesa è la stessa identica cosa di una busta
 * pronta: qualcuno aspetta che tu faccia una mossa. Stesso significato,
 * stesso colore.
 *
 * Perché qui NON ci sono Accetta e Rifiuta. Si potrebbero mettere, e si
 * risparmierebbe una navigazione. Ma per decidere se accettare bisogna
 * vedere se quell'ora è già occupata da qualcos'altro — e quello si vede
 * solo aprendo il giorno. La striscia porta lì: è un indice, non un banco
 * di lavoro.
 */

export type RichiestaSospesa = {
  id: string;
  inizio: string; // ISO
  giorno: string; // "2026-08-03"
  giornoEtichetta: string; // "sab 3 ago"
  servizio: string;
  cliente: string;
  telefono?: string | null;
};

export function StrisciaRichieste({ richieste }: { richieste: RichiestaSospesa[] }) {
  if (richieste.length === 0) return null;

  const n = richieste.length;

  return (
    <section
      aria-label="Richieste in sospeso"
      className="mb-6 overflow-hidden rounded border border-verde-200 bg-verde-50"
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-verde-200 bg-verde-100 px-4 py-2.5">
        {/* i due punti del marchio, in verde: è la firma che dice «questo
            arriva da noi», e qui è vero alla lettera */}
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          <i className="block h-1.5 w-1.5 rounded-full bg-verde-700" />
          <i className="block h-1.5 w-1.5 rounded-full bg-verde-700" />
        </span>
        <b className="text-sm text-verde-700">
          {n === 1 ? "1 richiesta in sospeso" : `${n} richieste in sospeso`}
        </b>
        <span className="text-xs text-verde-600">arrivate dalla pagina del negozio</span>
        <span className="ml-auto font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-verde-600">
          rispondi entro 24 ore
        </span>
      </header>

      <ul>
        {richieste.map((r) => (
          <li key={r.id}>
            <Link
              // `data`, non `giorno`: è il nome del parametro che la pagina
              // legge (`searchParams.data`). Con `giorno` il link si apriva
              // sempre su oggi e la striscia sembrava non funzionare.
              href={`/agenda?data=${r.giorno}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-verde-200 bg-white px-4 py-3 first:border-t-0 hover:bg-verde-50"
            >
              <span className="w-20 shrink-0 text-sm font-semibold text-inchiostro">
                {r.giornoEtichetta}
              </span>
              <span className="w-16 shrink-0 font-mono text-[15px] font-semibold text-verde-700">
                {oraDi(r.inizio)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="f-serif block text-[15px] font-semibold text-inchiostro">
                  {r.cliente}
                </span>
                <span className="block text-xs text-soft">
                  {r.servizio}
                  {/* Il telefono serve: spesso l'ottico non vuole accettare,
                      vuole chiamare e chiedere. Averlo qui gli risparmia
                      di aprire la scheda. */}
                  {r.telefono ? ` · ${r.telefono}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
