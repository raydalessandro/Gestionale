"use client";

import { useActionState, useState } from "react";
import {
  eventoAppuntamento,
  accettaRichiesta,
  rifiutaRichiesta,
  prendiComeCliente,
} from "@/lib/actions";
import { Errore } from "@/components/ui";

/* Classi riusate (nessuno stile nuovo: l'aspetto è provvisorio). */
const BTN_SCURO =
  "rounded-lg bg-inchiostro px-3 py-1.5 text-xs font-semibold text-carta hover:bg-black disabled:opacity-50";
const BTN_CHIARO =
  "rounded-lg border border-linea bg-white px-3 py-1.5 text-xs font-semibold text-soft hover:bg-carta disabled:opacity-50";
const BTN_ROSSO =
  "rounded-lg border border-rosso/40 bg-white px-3 py-1.5 text-xs font-semibold text-rosso hover:bg-rosso-soft disabled:opacity-50";
const BTN_OTTONE =
  "rounded-lg bg-ottone px-3 py-1.5 text-xs font-semibold text-white hover:bg-ottone-scuro disabled:opacity-50";

/**
 * Le azioni sulla riga d'agenda sono ORA consapevoli dello stato (§7):
 *  · in_attesa → Accetta / Rifiuta (le transizioni nuove);
 *  · prenotato → Completato / Non presentato / Annulla (le tre di sempre) e, se la
 *    riga viene dal portale ed è ancora libera, «Prendi come cliente» (§6);
 *  · stati finali → niente.
 */
export function AzioniAppuntamento({
  id,
  stato,
  prenotazioneId,
  prendibile,
}: {
  id: string;
  stato: string;
  prenotazioneId?: string | null;
  prendibile?: boolean; // prenotazione accettata dal portale, non ancora presa come cliente
}) {
  if (stato === "in_attesa") return <AzioniInAttesa id={id} />;
  if (stato === "prenotato")
    return (
      <div className="flex flex-col items-end gap-1.5">
        <AzioniPrenotato id={id} />
        {prenotazioneId && prendibile && <PrendiCliente prenotazioneId={prenotazioneId} />}
      </div>
    );
  return null;
}

/** Le tre di sempre su un appuntamento prenotato (comportamento pre-G8). */
function AzioniPrenotato({ id }: { id: string }) {
  const [sc, runC, inC] = useActionState(eventoAppuntamento.bind(null, id, "completa"), null);
  const [sm, runM, inM] = useActionState(eventoAppuntamento.bind(null, id, "mancato"), null);
  const [sa, runA, inA] = useActionState(eventoAppuntamento.bind(null, id, "annulla"), null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <form action={runC}>
          <button type="submit" disabled={inC} className={BTN_SCURO}>
            {inC ? "…" : "Completato"}
          </button>
        </form>
        <form action={runM}>
          <button type="submit" disabled={inM} className={BTN_CHIARO}>
            {inM ? "…" : "Non presentato"}
          </button>
        </form>
        <form action={runA}>
          <button type="submit" disabled={inA} className={BTN_ROSSO}>
            {inA ? "…" : "Annulla"}
          </button>
        </form>
      </div>
      <Errore msg={sc?.errore ?? sm?.errore ?? sa?.errore} />
    </div>
  );
}

/** Accetta / Rifiuta su una richiesta in attesa (§4/§5). */
function AzioniInAttesa({ id }: { id: string }) {
  const [sac, runAcc, inAcc] = useActionState(accettaRichiesta.bind(null, id), null);
  const [srf, runRif, inRif] = useActionState(rifiutaRichiesta.bind(null, id), null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <form action={runAcc}>
          <button type="submit" disabled={inAcc} className={BTN_OTTONE}>
            {inAcc ? "…" : "Accetta"}
          </button>
        </form>
        <form action={runRif} className="flex items-center gap-1">
          <input
            name="motivo"
            placeholder="Motivo (facolt.)"
            className="w-32 rounded-lg border border-linea bg-white px-2 py-1.5 text-xs text-inchiostro placeholder:text-faint"
          />
          <button type="submit" disabled={inRif} className={BTN_ROSSO}>
            {inRif ? "…" : "Rifiuta"}
          </button>
        </form>
      </div>
      <Errore msg={sac?.errore ?? srf?.errore} />
    </div>
  );
}

/**
 * «Prendi come cliente» (§6) — atto separato su un appuntamento già accettato.
 * Primo tocco: cerca un cliente proprio con lo stesso numero. Se c'è, propone di
 * collegarlo invece di duplicare; altrimenti crea subito.
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
    return <span className="text-xs font-semibold text-verde">Preso come cliente ✓</span>;

  if (fase === "proposta" && prop)
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="text-right text-xs text-soft">
          C&apos;è già{" "}
          <span className="font-semibold text-inchiostro">
            {prop.cognome} {prop.nome}
          </span>{" "}
          con questo numero.
        </p>
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" disabled={busy} onClick={() => conferma({ collega: prop.id })} className={BTN_SCURO}>
            {busy ? "…" : "Collega quello"}
          </button>
          <button type="button" disabled={busy} onClick={() => conferma("nuovo")} className={BTN_CHIARO}>
            {busy ? "…" : "Crea nuovo"}
          </button>
        </div>
        <Errore msg={err} />
      </div>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={avvia} className={BTN_CHIARO}>
        {busy ? "…" : "Prendi come cliente"}
      </button>
      <Errore msg={err} />
    </div>
  );
}
