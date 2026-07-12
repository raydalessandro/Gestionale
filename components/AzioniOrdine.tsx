"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  eventoOrdineLac,
  eventoBusta,
  aggiungiNotaOrdine,
} from "@/lib/actions";
import { inputCls, Errore } from "@/components/ui";
import { fmtEuro } from "@/lib/utils";

type EventoLac = "ordina" | "arriva" | "avvisa" | "consegna" | "annulla";
type EventoBusta =
  | "conferma"
  | "arriva"
  | "ispeziona"
  | "avvisa"
  | "consegna"
  | "annulla"
  | "remake";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const stili = {
  primary: "bg-inchiostro text-carta hover:bg-black",
  accent: "bg-ottone text-white hover:bg-ottone-scuro",
  ghost: "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta",
  danger: "border border-rosso/40 bg-white text-rosso hover:bg-rosso-soft",
} as const;

type Variante = keyof typeof stili;

/* ── Bottoni base ──────────────────────────────────────────────────── */

function BottoneEvento({
  azione,
  label,
  variante = "primary",
}: {
  azione: (prev: { errore: string } | null, fd: FormData) => Promise<{ errore: string } | null>;
  label: string;
  variante?: Variante;
}) {
  const [stato, run, inCorso] = useActionState(azione, null);
  return (
    <div className="space-y-2">
      <form action={run}>
        <button type="submit" disabled={inCorso} className={`${btn} ${stili[variante]}`}>
          {inCorso ? "…" : label}
        </button>
      </form>
      <Errore msg={stato?.errore} />
    </div>
  );
}

function BottoneMotivo({
  azione,
  label,
  variante = "danger",
  placeholder,
}: {
  azione: (prev: { errore: string } | null, fd: FormData) => Promise<{ errore: string } | null>;
  label: string;
  variante?: Variante;
  placeholder: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(azione, null);

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className={`${btn} ${stili[variante]}`}
      >
        {label}
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-linea p-3">
      <textarea
        name="motivo"
        rows={2}
        required
        placeholder={placeholder}
        className={inputCls}
      />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili[variante]}`}>
          {inCorso ? "…" : label}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className={`${btn} ${stili.ghost}`}
        >
          Chiudi
        </button>
      </div>
    </form>
  );
}

/* ── Azioni LAC ────────────────────────────────────────────────────── */

export function AzioniLac({
  id,
  stato,
  waHref,
}: {
  id: string;
  stato: string;
  waHref: string | null;
}) {
  const ev = (e: EventoLac) => eventoOrdineLac.bind(null, id, e);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {stato === "da_ordinare" && (
        <BottoneEvento azione={ev("ordina")} label="Segna ordinato" />
      )}
      {stato === "ordinato" && (
        <BottoneEvento azione={ev("arriva")} label="Segna arrivato" />
      )}
      {stato === "arrivato" && (
        <>
          <BottoneEvento azione={ev("consegna")} label="Consegna" variante="accent" />
          <BottoneEvento azione={ev("avvisa")} label="Segna avvisato" variante="ghost" />
          {waHref && <BottoneWhatsApp href={waHref} />}
        </>
      )}
      {["da_ordinare", "ordinato", "arrivato"].includes(stato) && (
        <BottoneMotivo
          azione={ev("annulla")}
          label="Annulla ordine"
          placeholder="Motivo dell'annullamento…"
        />
      )}
      {(stato === "consegnato" || stato === "annullato") && (
        <p className="text-sm text-faint">Ordine {stato}: nessuna azione disponibile.</p>
      )}
    </div>
  );
}

/* ── Azioni Busta ──────────────────────────────────────────────────── */

export function AzioniBusta({
  id,
  stato,
  saldo,
  accontoSuggerito,
  waHref,
}: {
  id: string;
  stato: string;
  saldo: number;
  accontoSuggerito: number;
  waHref: string | null;
}) {
  const ev = (e: EventoBusta) => eventoBusta.bind(null, id, e);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {stato === "preventivo" && (
        <BottoneConferma azione={ev("conferma")} accontoSuggerito={accontoSuggerito} />
      )}
      {stato === "lavorazione" && (
        <BottoneEvento azione={ev("arriva")} label="Segna arrivata" />
      )}
      {stato === "arrivata" && (
        <BottoneEvento
          azione={ev("ispeziona")}
          label="Ispeziona e segna pronta"
          variante="accent"
        />
      )}
      {stato === "pronta" && (
        <>
          <BottoneConsegna azione={ev("consegna")} saldo={saldo} />
          <BottoneEvento azione={ev("avvisa")} label="Segna avvisata" variante="ghost" />
          {waHref && <BottoneWhatsApp href={waHref} />}
        </>
      )}
      {["arrivata", "pronta"].includes(stato) && (
        <BottoneMotivo
          azione={ev("remake")}
          label="Remake"
          variante="ghost"
          placeholder="Motivo del remake (es. graffio su AR)…"
        />
      )}
      {["preventivo", "lavorazione", "arrivata", "pronta"].includes(stato) && (
        <BottoneMotivo
          azione={ev("annulla")}
          label="Annulla busta"
          placeholder="Motivo dell'annullamento…"
        />
      )}
      {(stato === "consegnata" || stato === "annullata") && (
        <p className="text-sm text-faint">Busta {stato}: nessuna azione disponibile.</p>
      )}
    </div>
  );
}

function BottoneConferma({
  azione,
  accontoSuggerito,
}: {
  azione: (prev: { errore: string } | null, fd: FormData) => Promise<{ errore: string } | null>;
  accontoSuggerito: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(azione, null);

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className={`${btn} ${stili.primary}`}
      >
        Conferma ordine
      </button>
    );
  }
  return (
    <form action={run} className="w-full max-w-xs space-y-2 rounded-xl border border-linea p-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-soft">
        Acconto (€)
      </label>
      <input
        name="acconto"
        type="number"
        step="0.01"
        min={0}
        defaultValue={accontoSuggerito}
        className={`${inputCls} diottria`}
      />
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.primary}`}>
          {inCorso ? "…" : "Conferma"}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className={`${btn} ${stili.ghost}`}
        >
          Chiudi
        </button>
      </div>
    </form>
  );
}

function BottoneConsegna({
  azione,
  saldo,
}: {
  azione: (prev: { errore: string } | null, fd: FormData) => Promise<{ errore: string } | null>;
  saldo: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, run, inCorso] = useActionState(azione, null);

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className={`${btn} ${stili.accent}`}
      >
        Consegna
      </button>
    );
  }
  return (
    <form action={run} className="w-full space-y-2 rounded-xl border border-ottone bg-ottone-soft p-3">
      <p className="text-sm text-inchiostro">
        Saldo da incassare:{" "}
        <span className="f-mono font-semibold">{fmtEuro(saldo)}</span> — confermi la
        consegna?
      </p>
      <Errore msg={stato?.errore} />
      <div className="flex gap-2">
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.accent}`}>
          {inCorso ? "…" : "Conferma consegna"}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className={`${btn} ${stili.ghost}`}
        >
          Chiudi
        </button>
      </div>
    </form>
  );
}

function BottoneWhatsApp({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${btn} ${stili.ghost}`}
    >
      <MessageCircle size={16} /> Apri WhatsApp
    </a>
  );
}

/* ── Nota rapida ───────────────────────────────────────────────────── */

export function NotaRapida({ tipo, id }: { tipo: "lac" | "buste"; id: string }) {
  const azione = aggiungiNotaOrdine.bind(null, tipo, id);
  const [stato, run, inCorso] = useActionState(azione, null);
  return (
    <form action={run} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="testo"
          placeholder="Aggiungi una nota…"
          className={`${inputCls} flex-1`}
        />
        <button type="submit" disabled={inCorso} className={`${btn} ${stili.ghost}`}>
          {inCorso ? "…" : "Aggiungi"}
        </button>
      </div>
      <Errore msg={stato?.errore} />
    </form>
  );
}
