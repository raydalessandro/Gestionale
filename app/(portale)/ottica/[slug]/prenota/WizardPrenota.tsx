"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { ServizioPubblicoRow } from "@/lib/database.types";
import { fonteDaParametro } from "@/lib/portale/fonte";
import { oggiISO, giornoRelativo, etichettaGiorno, oraDaISO } from "@/lib/portale/orari";
import { Btn } from "@/components/portale/primitivi";
import { inviaPrenotazione, type RisultatoPrenota } from "./azioni";

/**
 * Il percorso guidato (G7). Client component: una domanda per schermata, si usa
 * in piedi sul marciapiede con una mano. Il PASSO sta nell'URL (?passo) così il
 * tasto indietro del telefono funziona; le RISPOSTE stanno nello stato (un
 * refresh ricomincia, ed è accettabile per un percorso da un minuto). Niente
 * localStorage né cookie. La scrittura passa dall'azione server (rate limit): il
 * browser non chiama mai crea_prenotazione. La vera difesa dal doppio invio è la
 * `chiave_richiesta` stabile, non il bottone disabilitato.
 */

type Copertura = "si" | "no" | "nsp";
const ETI_COPERTURA: Record<Copertura, string> = {
  si: "Sì, ho una copertura",
  no: "No",
  nsp: "Non lo so",
};

export default function WizardPrenota({
  slug,
  nomeNegozio,
  servizi,
  da,
}: {
  slug: string;
  nomeNegozio: string;
  servizi: ServizioPubblicoRow[];
  da: string | null;
}) {
  const fonte = fonteDaParametro(da); // trascinata lungo tutto il percorso
  const chiave = useRef<string>("");
  if (!chiave.current) {
    chiave.current =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const sb = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      ),
    []
  );

  const [passo, setPasso] = useState(1);
  const [servizio, setServizio] = useState<ServizioPubblicoRow | null>(null);
  const [copertura, setCopertura] = useState<Copertura | null>(null);
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [perAltro, setPerAltro] = useState(false);
  const [perContoDi, setPerContoDi] = useState("");
  const [giorno, setGiorno] = useState(() => oggiISO(new Date()));
  const [inizioISO, setInizioISO] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [caricando, setCaricando] = useState(false);
  const [informativa, setInformativa] = useState(false);
  const [listaAttesa, setListaAttesa] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ codice: string; inizioISO: string; durata: number } | null>(null);

  const oggi = oggiISO(new Date());
  const urlPasso = useCallback(
    (n: number) => `?passo=${n}${da ? `&da=${encodeURIComponent(da)}` : ""}`,
    [da]
  );
  const vai = useCallback(
    (n: number) => {
      setPasso(n);
      window.history.pushState({ passo: n }, "", urlPasso(n));
      window.scrollTo(0, 0);
    },
    [urlPasso]
  );

  useEffect(() => {
    window.history.replaceState({ passo: 1 }, "", urlPasso(1));
    const onPop = (e: PopStateEvent) => setPasso((e.state?.passo as number) ?? 1);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [urlPasso]);

  // Slot veri (passo 4). Letti dal browser con la chiave anon: è una lettura.
  useEffect(() => {
    if (passo !== 4 || !servizio) return;
    let vivo = true;
    setCaricando(true);
    (async () => {
      const { data } = await sb.rpc("slot_liberi", {
        p_slug: slug,
        p_servizio: servizio.codice,
        p_giorno: giorno,
      });
      if (!vivo) return;
      setSlots((data as string[]) ?? []);
      setCaricando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [passo, servizio, giorno, slug, sb]);

  async function invia() {
    if (!servizio || !inizioISO || inviando) return;
    setInviando(true);
    setErrore(null);
    const res: RisultatoPrenota = await inviaPrenotazione({
      slug,
      servizio: servizio.codice,
      inizioISO,
      nome,
      telefono,
      email,
      perContoDi: perAltro ? perContoDi : "",
      note: "",
      fonte,
      chiaveRichiesta: chiave.current,
      informativa,
      listaAttesa,
    });
    if (res.ok) {
      setEsito({ codice: res.codice, inizioISO: res.inizioISO, durata: res.durata });
    } else {
      setErrore(res.errore);
      setInviando(false); // ritentabile: la stessa chiave rende il retry idempotente
    }
  }

  // ── Schermata finale ──────────────────────────────────────────────────────
  if (esito) {
    return (
      <main className="mx-auto max-w-[520px] px-5 py-10 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-lim-faint">
          Richiesta inviata
        </p>
        <p className="mt-6 font-lim-display text-4xl font-bold tracking-wide text-lim-inchiostro">
          {esito.codice}
        </p>
        <p className="mt-2 text-[13px] text-lim-soft">Il tuo codice di riferimento</p>

        <div className="mt-8 rounded-2xl border border-lim-linea bg-white p-[18px] text-left text-[14.5px] text-lim-inchiostro">
          <Riga etichetta="Negozio" valore={nomeNegozio} />
          <Riga etichetta="Servizio" valore={servizio?.etichetta ?? ""} />
          <Riga etichetta="Quando" valore={`${etichettaGiorno(giorno)}, ${oraDaISO(esito.inizioISO)}`} />
          <Riga etichetta="Durata" valore={`${esito.durata} min`} ultima />
        </div>

        <p className="mt-6 text-[14.5px] leading-relaxed text-lim-inchiostro">
          La tua richiesta è arrivata al negozio. Non è ancora confermata:{" "}
          <strong>{nomeNegozio} la conferma</strong> e riceverai un avviso quando
          l'ha fatto.
        </p>

        <p className="mt-8 text-[13px] text-lim-faint">
          <Link href={`/ottica/${slug}`} className="font-semibold text-lim-ambra underline">
            Torna alla pagina del negozio
          </Link>
        </p>
      </main>
    );
  }

  const puoAvanzare3 = nome.trim().length > 0 && telefono.trim().length > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col px-5 pb-10 pt-6">
      {/* barra: indietro + progresso */}
      <div className="mb-6 flex items-center justify-between text-[13px] text-lim-soft">
        {passo > 1 ? (
          <button type="button" onClick={() => window.history.back()} className="font-semibold text-lim-inchiostro">
            ‹ Indietro
          </button>
        ) : (
          <Link href={`/ottica/${slug}`} className="font-semibold text-lim-inchiostro">
            ‹ Al negozio
          </Link>
        )}
        <span className="tabular-nums text-lim-faint">Passo {passo} di 5</span>
      </div>

      <h1 className="mb-1 font-lim-display text-[15px] font-semibold text-lim-faint">{nomeNegozio}</h1>

      {passo === 1 && (
        <Schermata titolo="Che cosa ti serve?">
          <div className="space-y-2.5">
            {servizi.map((s) => (
              <button
                key={s.codice}
                type="button"
                onClick={() => {
                  setServizio(s);
                  vai(2);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-[18px] py-4 text-left ${
                  servizio?.codice === s.codice ? "border-lim-inchiostro" : "border-lim-linea"
                } bg-white`}
              >
                <span className="text-[15.5px] font-semibold text-lim-inchiostro">{s.etichetta}</span>
                <span className="shrink-0 text-[13px] text-lim-soft">{s.durata_minuti} min</span>
              </button>
            ))}
            {servizi.length === 0 && (
              <p className="text-[14px] text-lim-soft">Questo negozio non ha servizi prenotabili online.</p>
            )}
          </div>
        </Schermata>
      )}

      {passo === 2 && (
        <Schermata titolo="Hai una copertura sanitaria?" sotto="Serve solo al negozio per prepararsi. Nessuna assicurazione da scegliere.">
          <div className="space-y-2.5">
            {(["si", "no", "nsp"] as Copertura[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCopertura(c);
                  vai(3);
                }}
                className={`w-full rounded-2xl border px-[18px] py-4 text-left text-[15.5px] font-semibold text-lim-inchiostro ${
                  copertura === c ? "border-lim-inchiostro" : "border-lim-linea"
                } bg-white`}
              >
                {ETI_COPERTURA[c]}
              </button>
            ))}
          </div>
        </Schermata>
      )}

      {passo === 3 && (
        <Schermata titolo="Chi sei?">
          <div className="space-y-4">
            <Campo etichetta="Nome e cognome" obbligatorio>
              {(id) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={inputCls} />}
            </Campo>
            <Campo etichetta="Telefono" obbligatorio>
              {(id) => <input id={id} value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="tel" className={inputCls} />}
            </Campo>
            <Campo etichetta="Email (facoltativa)">
              {(id) => <input id={id} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" className={inputCls} />}
            </Campo>
            <label className="flex items-start gap-3 rounded-xl border border-lim-linea bg-white px-3.5 py-3">
              <input type="checkbox" checked={perAltro} onChange={(e) => setPerAltro(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-[14px] text-lim-inchiostro">Prenoto per un'altra persona</span>
            </label>
            {perAltro && (
              <Campo etichetta="Chi è il paziente?">
                {(id) => <input id={id} value={perContoDi} onChange={(e) => setPerContoDi(e.target.value)} className={inputCls} />}
              </Campo>
            )}
            <Btn full tinta="dark" disabled={!puoAvanzare3} onClick={() => vai(4)}>
              Continua
            </Btn>
          </div>
        </Schermata>
      )}

      {passo === 4 && (
        <Schermata titolo="Quando ti va bene?">
          <div className="mb-4 flex items-center justify-between gap-2">
            {giorno > oggi ? (
              <button type="button" onClick={() => setGiorno(giornoRelativo(giorno, -1))} className={navCls} aria-label="Giorno precedente">
                ‹
              </button>
            ) : (
              <span className="h-9 w-9" aria-hidden="true" />
            )}
            <span className="text-[14.5px] font-semibold capitalize text-lim-inchiostro">{etichettaGiorno(giorno)}</span>
            <button type="button" onClick={() => setGiorno(giornoRelativo(giorno, 1))} className={navCls} aria-label="Giorno successivo">
              ›
            </button>
          </div>

          {caricando ? (
            <p className="py-6 text-center text-[14px] text-lim-soft">Cerco gli orari liberi…</p>
          ) : slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setInizioISO(iso);
                    vai(5);
                  }}
                  className="rounded-xl border border-lim-linea bg-white px-2 py-2.5 text-center text-[14px] font-semibold tabular-nums text-lim-inchiostro"
                >
                  {oraDaISO(iso)}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-4 text-[14px] leading-relaxed text-lim-soft">
              Nessun orario libero {etichettaGiorno(giorno)}.{" "}
              <button type="button" onClick={() => setGiorno(giornoRelativo(giorno, 1))} className="font-semibold text-lim-ambra underline">
                Prova {etichettaGiorno(giornoRelativo(giorno, 1))}
              </button>
              .
            </p>
          )}
        </Schermata>
      )}

      {passo === 5 && servizio && inizioISO && (
        <Schermata titolo="Ci siamo">
          <div className="rounded-2xl border border-lim-linea bg-white p-[18px] text-[14.5px] text-lim-inchiostro">
            <Riga etichetta="Negozio" valore={nomeNegozio} />
            <Riga etichetta="Servizio" valore={servizio.etichetta} />
            <Riga etichetta="Quando" valore={`${etichettaGiorno(giorno)}, ${oraDaISO(inizioISO)}`} />
            <Riga etichetta="A nome di" valore={perAltro && perContoDi ? perContoDi : nome} ultima />
          </div>

          <label className="mt-4 flex items-start gap-3">
            <input type="checkbox" checked={informativa} onChange={(e) => setInformativa(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span className="text-[13.5px] leading-relaxed text-lim-inchiostro">
              Ho letto l'
              <Link href="/informativa" className="font-semibold text-lim-ambra underline">
                informativa privacy
              </Link>
              : i dati servono a gestire la prenotazione, il negozio scelto li vedrà, e questo non è un consenso commerciale.
            </span>
          </label>

          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" checked={listaAttesa} onChange={(e) => setListaAttesa(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span className="text-[13.5px] leading-relaxed text-lim-soft">
              Avvisami se si libera un orario prima (lista d'attesa).
            </span>
          </label>

          {errore && <p className="mt-4 text-[14px] font-semibold text-rosso">{errore}</p>}

          <div className="mt-5">
            <Btn full disabled={!informativa || inviando} onClick={invia}>
              {inviando ? "Invio…" : "Invia la richiesta"}
            </Btn>
          </div>
          <p className="mt-2.5 text-center text-[12.5px] text-lim-faint">
            È una richiesta: il negozio conferma.
          </p>
        </Schermata>
      )}
    </main>
  );
}

const inputCls =
  "w-full rounded-xl border border-lim-linea bg-white px-3.5 py-3 text-[16px] text-lim-inchiostro outline-none";
const navCls =
  "flex h-9 w-9 items-center justify-center rounded-full border border-lim-linea bg-white text-lim-inchiostro";

function Schermata({ titolo, sotto, children }: { titolo: string; sotto?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-lim-display text-2xl font-bold text-lim-inchiostro">{titolo}</h2>
      {sotto && <p className="mb-4 mt-1 text-[14px] text-lim-soft">{sotto}</p>}
      <div className={sotto ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function Campo({
  etichetta,
  obbligatorio,
  children,
}: {
  etichetta: string;
  obbligatorio?: boolean;
  /** Render-prop: riceve l'id da mettere sull'input, così label e campo sono
   *  associati (accessibilità + test che cercano il campo dalla sua etichetta). */
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-lim-inchiostro">
        {etichetta}
        {obbligatorio && <span className="text-lim-ambra"> *</span>}
      </label>
      {children(id)}
    </div>
  );
}

function Riga({ etichetta, valore, ultima }: { etichetta: string; valore: string; ultima?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${ultima ? "" : "border-b border-lim-linea"}`}>
      <span className="shrink-0 text-[13px] text-lim-soft">{etichetta}</span>
      <span className="text-right font-semibold text-lim-inchiostro">{valore}</span>
    </div>
  );
}
