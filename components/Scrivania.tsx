import Link from "next/link";
import type { ReactNode } from "react";
import { Icona, type NomeIcona } from "@/components/Icone";
import { FiguraVuota } from "@/components/FigureVuote";

/**
 * La Scrivania — la schermata che si apre alle nove.
 *
 * Portata dal prototipo `scrivania-ipad.html`, con le correzioni elencate in
 * `docs/design/RAMO-6-scrivania.md §2`. Le due che si vedono a occhio:
 * la pelle è quella di DS-01 (raggio 5, nessuna ombra, carta #F9EFEA) e non
 * quella del prototipo (raggio 14, due ombre, carta #F7F4F3); e l'ambra
 * compare due volte per schermata, non tre.
 *
 * Perché non è la dashboard di oggi. La dashboard mostra **quanto**: quattro
 * numeri e gli ultimi clienti. La scrivania mostra **cosa fare adesso**, in
 * ordine, con il motivo accanto. È la differenza fra un cruscotto e un banco.
 *
 * Tutti i componenti qui dentro sono presentazionali: prendono props e non
 * leggono niente. Le letture che servono sono in `dati-mancanti.md §7`.
 */

/* ── Mattoni comuni ────────────────────────────────────────────────────── */

export function Scheda({
  titolo,
  spalla,
  children,
  piede,
}: {
  titolo: string;
  spalla?: ReactNode;
  children: ReactNode;
  piede?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded border border-linea bg-white">
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
        <h2 className="f-serif text-[17px] font-semibold tracking-tight text-inchiostro">
          {titolo}
        </h2>
        {spalla && <span className="ml-auto text-[13px] text-soft">{spalla}</span>}
      </header>
      {children}
      {piede && (
        <footer className="flex items-center gap-3 border-t border-linea bg-carta px-4 py-3">
          {piede}
        </footer>
      )}
    </section>
  );
}

export function Etichetta({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.15em] text-soft">
      {children}
    </span>
  );
}

type Tinta = "verde" | "blu" | "rosso" | "grigio";

const TINTE: Record<Tinta, string> = {
  verde: "bg-verde-50 border-verde-100 text-verde-700",
  blu: "bg-blu-50 border-blu-100 text-blu-700",
  rosso: "bg-rosso-50 border-rosso-100 text-rosso-700",
  grigio: "bg-carta border-linea text-soft",
};

export function Stato({ tinta, children }: { tinta: Tinta; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${TINTE[tinta]}`}
    >
      <i className="block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

/* ── 1 · Il prossimo appuntamento ──────────────────────────────────────── */

export type Prossimo = {
  ora: string;
  chi: string;
  perche: string;
  manca: string;
  /** 0–100. Quanto della finestra prima dell'arrivo è già passato. */
  percentuale: number;
  allerta?: { titolo: string; testo: string };
  href: string;
};

export function ProssimoAppuntamento({
  prossimo,
  vuoto,
}: {
  prossimo: Prossimo | null;
  /** Cosa dire quando non c'è un prossimo: non «nessun appuntamento», ma
   *  quando ricomincia e con chi. */
  vuoto: { titolo: string; testo: string; azione: ReactNode };
}) {
  if (!prossimo) {
    return (
      <section className="rounded border border-linea bg-white px-5 pb-5 pt-4">
        <Etichetta>Prossimo appuntamento</Etichetta>
        <div className="mt-3 flex gap-4">
          <FiguraVuota nome="agenda" size={72} className="shrink-0" />
          <div>
            <p className="f-serif text-[19px] font-semibold tracking-tight text-inchiostro">
              {vuoto.titolo}
            </p>
            <p className="mt-1 max-w-[44ch] text-sm text-soft">{vuoto.testo}</p>
            <div className="mt-4">{vuoto.azione}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    // Niente ombra, al contrario del prototipo: su carta tinta la scheda
    // bianca si solleva da sola, ed è il meccanismo di tutta l'applicazione.
    // Qui la scheda si distingue perché è l'unica col bordo pieno `linea`.
    <section className="overflow-hidden rounded border border-linea bg-white">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Etichetta>Prossimo appuntamento</Etichetta>
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-linea bg-carta px-3 py-1.5 text-[13px] font-semibold text-inchiostro">
          <i className="block h-1.5 w-1.5 rounded-full bg-verde-500" />
          {prossimo.manca}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 px-5 pt-2">
        <span className="f-serif text-[34px] font-semibold tabular-nums tracking-tight text-inchiostro">
          {prossimo.ora}
        </span>
        <span className="f-serif text-[30px] font-semibold tracking-tight text-inchiostro">
          {prossimo.chi}
        </span>
      </div>
      <p className="px-5 pt-1 text-[15px] text-soft">{prossimo.perche}</p>

      {prossimo.allerta && (
        // Filetto a sinistra, come l'errore nei primitivi: sempre a sinistra,
        // sempre a dire «guarda qui prima».
        <div className="mx-5 mt-3.5 flex items-start gap-3 rounded-r border-l-[3px] border-rosso-600 bg-rosso-50 px-3.5 py-3">
          <span className="mt-0.5 shrink-0 text-rosso-700">
            <Icona nome="attenzione" size={16} />
          </span>
          <span className="flex-1 text-[13.5px] text-rosso-700">
            <b className="block font-semibold">{prossimo.allerta.titolo}</b>
            {prossimo.allerta.testo}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 px-5 pb-5 pt-4">
        <span className="min-w-[170px] flex-1">
          <span className="block h-1.5 overflow-hidden rounded-full bg-neutro-100">
            <i
              className="block h-full rounded-full bg-neutro-400"
              style={{ width: `${Math.min(100, Math.max(0, prossimo.percentuale))}%` }}
            />
          </span>
          <small className="mt-1.5 block text-xs text-soft">
            Il tempo che hai davanti prima che arrivi
          </small>
        </span>
        <Link
          href={prossimo.href}
          className="inline-flex min-h-[44px] items-center justify-center rounded bg-inchiostro px-4 text-sm font-semibold text-carta transition-colors duration-scatto hover:bg-black"
        >
          Apri la pratica
        </Link>
      </div>
    </section>
  );
}

/* ── 2 · Cosa puoi fare adesso ─────────────────────────────────────────── */

export type Gesto = {
  id: string;
  tinta: "verde" | "blu" | "rosso";
  icona: NomeIcona;
  cosa: string;
  motivo: string;
  /** Stima, non misura. Vedi dati-mancanti.md §7.3: oggi è scritta a mano. */
  durata?: string;
  href: string;
};

const PASTIGLIA: Record<Gesto["tinta"], string> = {
  verde: "bg-verde-50 border-verde-100 text-verde-700",
  blu: "bg-blu-50 border-blu-100 text-blu-700",
  rosso: "bg-rosso-50 border-rosso-100 text-rosso-700",
};

export function CosaPuoiFareAdesso({
  gesti,
  quantoTempo,
  riassunto,
}: {
  gesti: Gesto[];
  quantoTempo: string;
  riassunto: string;
}) {
  return (
    <Scheda
      titolo="Cosa puoi fare adesso"
      spalla={quantoTempo}
      piede={
        <>
          <span className="min-w-0 flex-1 text-[13px] text-soft">{riassunto}</span>
          {gesti[0] && (
            <Link
              href={gesti[0].href}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded border border-linea bg-white px-3.5 text-[13.5px] font-semibold text-inchiostro transition-colors duration-scatto hover:bg-carta"
            >
              Inizia dalla prima
            </Link>
          )}
        </>
      }
    >
      {gesti.map((g) => (
        <Link
          key={g.id}
          href={g.href}
          className="flex min-h-[62px] w-full items-center gap-3.5 border-t border-linea px-4 py-2.5 text-left transition-colors duration-scatto hover:bg-carta"
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-content-center rounded border ${PASTIGLIA[g.tinta]}`}
          >
            <Icona nome={g.icona} size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-inchiostro">{g.cosa}</span>
            <span className="block truncate text-[13px] text-soft">{g.motivo}</span>
          </span>
          {g.durata && (
            <span className="shrink-0 font-mono text-[11.5px] text-soft">{g.durata}</span>
          )}
          <span className="shrink-0 text-neutro-400">
            <Icona nome="freccia-dx" size={14} />
          </span>
        </Link>
      ))}
    </Scheda>
  );
}

/* ── 3 · La tua giornata ───────────────────────────────────────────────── */

export type Fascia = {
  id: string;
  ora: string;
  chi: string;
  cosa: string;
  /** `pausa` non è un appuntamento: è il negozio che apre o chiude. */
  forma?: "ora" | "finita" | "saltata" | "pausa";
  stato?: { tinta: Tinta; testo: string };
  href?: string;
};

export function LaTuaGiornata({ fasce, spalla }: { fasce: Fascia[]; spalla: string }) {
  return (
    <Scheda
      titolo="La tua giornata"
      spalla={spalla}
      piede={
        <Link
          href="/agenda"
          className="text-[13.5px] font-semibold text-inchiostro underline-offset-4 hover:underline"
        >
          Vedi l&apos;agenda completa →
        </Link>
      }
    >
      {fasce.map((f) => {
        const pausa = f.forma === "pausa";
        const cls = `flex w-full items-center gap-3.5 border-t border-linea px-4 text-left ${
          pausa ? "py-2" : "min-h-[44px] py-2.5"
        } ${
          // «Adesso» col filetto a sinistra, inchiostro e non ambra:
          // l'ambra è l'azione e questa non è un'azione, è una posizione.
          f.forma === "ora" ? "border-l-[3px] border-l-inchiostro bg-carta pl-[13px]" : ""
        } ${f.href ? "transition-colors duration-scatto hover:bg-carta" : ""}`;
        const dentro = (
          <>
            <span
              className={`w-12 shrink-0 font-mono text-[13.5px] tabular-nums ${
                f.forma === "ora"
                  ? "font-semibold text-inchiostro"
                  : f.forma === "finita"
                    ? "text-neutro-500"
                    : "text-soft"
              }`}
            >
              {f.ora}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[15px] ${
                  pausa
                    ? "text-[12px] text-soft"
                    : f.forma === "ora"
                      ? "font-semibold text-inchiostro"
                      : f.forma === "finita"
                        ? "text-neutro-500"
                        : f.forma === "saltata"
                          ? "text-neutro-500 line-through decoration-linea"
                          : "text-inchiostro"
                }`}
              >
                {f.chi}
              </span>
              {!pausa && (
                <span className="block truncate text-[12.5px] text-soft">{f.cosa}</span>
              )}
            </span>
            {f.stato && <Stato tinta={f.stato.tinta}>{f.stato.testo}</Stato>}
          </>
        );
        return f.href ? (
          <Link key={f.id} href={f.href} className={cls}>
            {dentro}
          </Link>
        ) : (
          <div key={f.id} className={cls}>
            {dentro}
          </div>
        );
      })}
    </Scheda>
  );
}

/* ── 4 · Righe di destra: arrivi, da avvisare, urgenti ─────────────────── */

export type RigaScrivania = {
  id: string;
  q: string;
  m: string;
  stato?: { tinta: Tinta; testo: string };
  /** Filetto rosso a sinistra: una promessa a rischio, non un dettaglio. */
  grave?: string;
  azione?: ReactNode;
  href?: string;
};

export function ElencoScrivania({
  titolo,
  spalla,
  righe,
  piede,
}: {
  titolo: string;
  spalla?: string;
  righe: RigaScrivania[];
  piede?: ReactNode;
}) {
  return (
    <Scheda titolo={titolo} spalla={spalla} piede={piede}>
      {righe.map((r) => {
        const dentro = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-inchiostro">{r.q}</span>
              <span className="block text-[12.5px] text-soft">{r.m}</span>
              {r.grave && (
                <span className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-rosso-700">
                  <Icona nome="attenzione" size={14} />
                  {r.grave}
                </span>
              )}
            </span>
            {r.stato && <Stato tinta={r.stato.tinta}>{r.stato.testo}</Stato>}
            {r.azione}
          </>
        );
        const cls = `flex min-h-[60px] w-full items-center gap-3 border-t border-linea px-4 py-2.5 text-left ${
          r.grave ? "border-l-[3px] border-l-rosso-500 pl-[13px]" : ""
        }`;
        return r.href ? (
          <Link
            key={r.id}
            href={r.href}
            className={`${cls} transition-colors duration-scatto hover:bg-carta`}
          >
            {dentro}
          </Link>
        ) : (
          <div key={r.id} className={cls}>
            {dentro}
          </div>
        );
      })}
    </Scheda>
  );
}

/* ── L'impianto ────────────────────────────────────────────────────────── */

/**
 * Due colonne che scorrono ciascuna per conto suo, 1.3 : 1.
 *
 * Sotto i 1000px diventa una colonna sola e la pagina scorre intera: su un
 * telefono due colonne che scorrono separate sono un'imboscata, e su un iPad
 * in verticale la seconda diventa troppo stretta per le pastiglie di stato.
 */
export function ImpiantoScrivania({
  sinistra,
  destra,
}: {
  sinistra: ReactNode;
  destra: ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">{sinistra}</div>
      <div className="flex min-w-0 flex-col gap-4">{destra}</div>
    </div>
  );
}
