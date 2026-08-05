"use client";

import { useActionState, useState } from "react";
import {
  eventoAppuntamento,
  accettaRichiesta,
  rifiutaRichiesta,
  prendiComeCliente,
} from "@/lib/actions";
import { Errore } from "@/components/ui";
import { Icona } from "@/components/Icone";

/**
 * Azioni sulla riga d'agenda — passata di design (ramo 3).
 *
 * La logica è quella di G8/018 e non è stata toccata: stesse azioni server,
 * stessa macchina a stati, stesse transizioni. Cambia come si presentano.
 *
 * Tre scelte di comportamento, tutte dentro il componente:
 *
 *  1. Il campo «motivo» non è più sempre in vista. Compare solo dopo aver
 *     premuto Rifiuta. Prima ogni riga in attesa portava una casella di testo
 *     vuota che nel 90% dei casi resta vuota: rumore su una schermata che si
 *     guarda di sfuggita.
 *
 *  2. Accetta è verde, non ottone. Una richiesta in attesa è la stessa cosa di
 *     una busta pronta: qualcuno aspetta che tu faccia una mossa.
 *
 *  3. Bersagli a 44px: la postazione è un tablet. Le righe si alzano, e va bene.
 */

const BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded px-3.5 text-sm font-semibold transition-colors duration-scatto disabled:cursor-not-allowed disabled:opacity-50";
const BTN_VERDE = `${BTN} bg-verde-600 text-white hover:bg-verde-700`;
const BTN_SCURO = `${BTN} bg-inchiostro text-carta hover:bg-black`;
const BTN_CHIARO = `${BTN} border border-linea bg-white text-inchiostro hover:bg-carta`;
const BTN_ROSSO = `${BTN} border border-rosso-200 bg-white text-rosso-700 hover:bg-rosso-50`;
const BTN_ICONA =
  "inline-flex min-h-[44px] w-11 items-center justify-center rounded border border-linea bg-white text-soft transition-colors duration-scatto hover:border-faint hover:text-inchiostro disabled:opacity-50";

export function AzioniAppuntamento({
  id,
  stato,
  prenotazioneId,
  prendibile,
}: {
  id: string;
  stato: string;
  prenotazioneId?: string | null;
  prendibile?: boolean;
}) {
  if (stato === "in_attesa") return <AzioniInAttesa id={id} />;
  if (stato === "prenotato")
    return (
      <div className="flex flex-col items-end gap-2">
        <AzioniPrenotato id={id} />
        {prenotazioneId && prendibile && <PrendiCliente prenotazioneId={prenotazioneId} />}
      </div>
    );
  return null;
}

/* ── Prenotato: le tre di sempre ──────────────────────────────────── */

function AzioniPrenotato({ id }: { id: string }) {
  const [sc, runC, inC] = useActionState(eventoAppuntamento.bind(null, id, "completa"), null);
  const [sm, runM, inM] = useActionState(eventoAppuntamento.bind(null, id, "mancato"), null);
  const [sa, runA, inA] = useActionState(eventoAppuntamento.bind(null, id, "annulla"), null);
  const [annullando, setAnnullando] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={runC}>
          <button type="submit" disabled={inC} className={BTN_SCURO}>
            <Icona nome="spunta" size={16} />
            {inC ? "…" : "Completato"}
          </button>
        </form>
        <form action={runM}>
          <button type="submit" disabled={inM} className={BTN_CHIARO}>
            {inM ? "…" : "Non presentato"}
          </button>
        </form>
        {!annullando ? (
          <button type="button" onClick={() => setAnnullando(true)} className={BTN_ROSSO}>
            Annulla
          </button>
        ) : (
          <form action={runA} className="flex items-center gap-1.5">
            <input
              name="motivo"
              placeholder="Motivo (facoltativo)"
              autoFocus
              className="min-h-[44px] w-44 rounded border border-linea bg-white px-3 text-base text-inchiostro placeholder:text-faint focus:border-ambra-500 focus:outline-none focus:ring-2 focus:ring-ambra-100"
            />
            <button type="submit" disabled={inA} className={BTN_ROSSO}>
              {inA ? "…" : "Conferma"}
            </button>
            <button
              type="button"
              onClick={() => setAnnullando(false)}
              className={BTN_ICONA}
              aria-label="Lascia stare"
            >
              <Icona nome="croce" size={16} />
            </button>
          </form>
        )}
      </div>
      <Errore msg={sc?.errore ?? sm?.errore ?? sa?.errore} />
    </div>
  );
}

/* ── In attesa: accetta o rifiuta ─────────────────────────────────── */

function AzioniInAttesa({ id }: { id: string }) {
  const [sac, runAcc, inAcc] = useActionState(accettaRichiesta.bind(null, id), null);
  const [srf, runRif, inRif] = useActionState(rifiutaRichiesta.bind(null, id), null);
  // Il motivo compare solo se serve: nel caso normale la riga resta pulita.
  const [rifiutando, setRifiutando] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {!rifiutando ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <form action={runAcc}>
            <button type="submit" disabled={inAcc} className={BTN_VERDE}>
              <Icona nome="spunta" size={16} />
              {inAcc ? "…" : "Accetta"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setRifiutando(true)}
            className={BTN_ICONA}
            aria-label="Rifiuta la richiesta"
            title="Rifiuta"
          >
            <Icona nome="croce" size={17} />
          </button>
        </div>
      ) : (
        <form action={runRif} className="flex flex-wrap items-center justify-end gap-1.5">
          <input
            name="motivo"
            placeholder="Perché? (facoltativo)"
            autoFocus
            className="min-h-[44px] w-52 rounded border border-linea bg-white px-3 text-base text-inchiostro placeholder:text-faint focus:border-ambra-500 focus:outline-none focus:ring-2 focus:ring-ambra-100"
          />
          <button type="submit" disabled={inRif} className={BTN_ROSSO}>
            {inRif ? "…" : "Rifiuta"}
          </button>
          <button
            type="button"
            onClick={() => setRifiutando(false)}
            className={BTN_ICONA}
            aria-label="Lascia stare"
          >
            <Icona nome="croce" size={16} />
          </button>
        </form>
      )}
      <Errore msg={sac?.errore ?? srf?.errore} />
    </div>
  );
}

/* ── Prendi come cliente ──────────────────────────────────────────────
 * Il momento in cui chi ha prenotato dal portale diventa clientela del
 * negozio. Se esiste già una scheda con lo stesso numero, l'azione server
 * propone di collegarla invece di duplicare.
 *
 * Le tre scelte sono riquadri separati con un filetto ambra sulla consigliata
 * (formato F2). Su un tablet tre bersagli distinti valgono più dell'eleganza:
 * con le righe attaccate il dito prende quella sbagliata, e collegare la scheda
 * di un altro è un errore che si scopre mesi dopo.
 *
 * Niente fondo pieno di proposito: la scelta consigliata va letta, non toccata
 * per riflesso. Tre pixel di filetto bastano a dire «guarda qui prima».
 */

function PrendiCliente({ prenotazioneId }: { prenotazioneId: string }) {
  const [fase, setFase] = useState<"idle" | "proposta" | "fatto">("idle");
  const [prop, setProp] = useState<{ id: string; nome: string; cognome: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function avvia() {
    setBusy(true);
    setErr(null);
    const r = await prendiComeCliente(prenotazioneId, "auto");
    setBusy(false);
    if ("errore" in r) setErr(r.errore);
    else if ("proposta" in r) {
      setProp(r.proposta);
      setFase("proposta");
    } else setFase("fatto");
  }

  async function conferma(scelta: "nuovo" | { collega: string }) {
    setBusy(true);
    setErr(null);
    const r = await prendiComeCliente(prenotazioneId, scelta);
    setBusy(false);
    if ("errore" in r) setErr(r.errore);
    else setFase("fatto");
  }

  if (fase === "fatto")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-verde-700">
        <Icona nome="spunta" size={15} />
        Preso come cliente
      </span>
    );

  if (fase === "proposta" && prop)
    return (
      <div className="w-full max-w-md rounded border border-linea bg-white p-4 text-left">
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-verde-700">
          Richiesta accettata
        </p>
        <p className="f-serif mt-1.5 text-lg font-semibold text-inchiostro">
          {prop.nome} {prop.cognome} è già un cliente?
        </p>
        <p className="mt-1.5 text-sm text-soft">
          Ha prenotato dal sito con un numero che in archivio è già di qualcuno.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <SceltaRiga
            icona="clienti"
            titolo={`Collega a ${prop.cognome} ${prop.nome}`}
            sotto="Le buste e i richiami finiscono sulla scheda che c'è già"
            consigliata
            disabled={busy}
            onClick={() => conferma({ collega: prop.id })}
          />
          <SceltaRiga
            icona="piu"
            titolo="Crea una scheda nuova"
            sotto="Se è una persona diversa con lo stesso numero"
            disabled={busy}
            onClick={() => conferma("nuovo")}
          />
          <SceltaRiga
            icona="attesa"
            titolo="Non ora"
            sotto="L'appuntamento resta valido, la scheda si collega più tardi"
            disabled={busy}
            onClick={() => setFase("idle")}
          />
        </div>
        <Errore msg={err} />
      </div>
    );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" disabled={busy} onClick={avvia} className={BTN_CHIARO}>
        <Icona nome="clienti" size={16} />
        {busy ? "…" : "Prendi come cliente"}
      </button>
      <Errore msg={err} />
    </div>
  );
}

/** Riga di scelta, formato F2: riquadro proprio, e sulla consigliata un filetto
 *  ambra da 3px sul bordo sinistro. Lo stesso segno dell'errore e della riga in
 *  attesa in agenda: sempre a sinistra, sempre a dire «guarda qui prima».
 *
 *  Passare a F6 (righe nude senza riquadro) è la riga `className` qui sotto:
 *  `border-t border-linea py-3 first:border-t-0` al posto del riquadro. */
function SceltaRiga({
  icona,
  titolo,
  sotto,
  consigliata = false,
  disabled,
  onClick,
}: {
  icona: "clienti" | "piu" | "attesa";
  titolo: string;
  sotto: string;
  consigliata?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded border border-linea bg-white px-3 py-3 text-left transition-colors duration-scatto hover:bg-carta disabled:opacity-50 ${
        consigliata ? "border-l-[3px] border-l-ambra-500 pl-[9px]" : ""
      }`}
    >
      <span className={consigliata ? "text-ambra-600" : "text-faint"}>
        <Icona nome={icona} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] font-semibold ${
            consigliata ? "text-ambra-700" : "text-inchiostro"
          }`}
        >
          {titolo}
        </span>
        <span className="mt-0.5 block text-xs text-soft">{sotto}</span>
      </span>
    </button>
  );
}
