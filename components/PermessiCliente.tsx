"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  registraConsenso,
  revocaMarketing,
  creaRelazione,
  eliminaRelazione,
  anonimizzaCliente,
} from "@/lib/actions";
import { Card, Field, inputCls, Errore } from "@/components/ui";
import { fmtData } from "@/lib/utils";

/**
 * B1 · La sezione «Permessi» della scheda cliente (M1 §5).
 *
 * È il MINIMO funzionale perché gli scenari M1 S2-S4 e S6 girino: il mastro dei
 * consensi leggibile, la firma con canali e modalità, la revoca dal tasto, le
 * relazioni lette nei due versi e l'eliminazione definitiva protetta.
 * **Niente estetica nuova**: componenti e classi sono quelli già in casa; la
 * passata di design arriva con gli innesti.
 *
 * Contratti in vigore qui:
 * - C3 · la riga «Marketing: …» è la CACHE (proiezione dell'ultimo evento), il
 *   mastro sotto è l'elenco dei FATTI. Nessuno dei due si scrive a mano.
 * - C4 · la relazione è UNA riga: l'etichetta inversa si deriva a video.
 * - C1 · l'anonimizzazione è possibile ma non comoda: conferma battuta a mano.
 */

const BTN =
  "rounded-lg bg-inchiostro px-3 py-1.5 text-xs font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50";
const BTN_CHIARO =
  "rounded-lg border border-linea bg-white px-3 py-1.5 text-xs font-semibold text-inchiostro transition-colors hover:bg-carta disabled:opacity-50";
const BTN_ROSSO =
  "rounded-lg border border-rosso/40 bg-white px-3 py-1.5 text-xs font-semibold text-rosso transition-colors hover:bg-rosso-soft disabled:opacity-50";

const CANALI = [
  { id: "email", label: "Email" },
  { id: "cellulare", label: "Cellulare" },
  { id: "cartaceo", label: "Cartaceo" },
] as const;

const TIPI_RELAZIONE = [
  { id: "tutore_legale", label: "Tutore legale" },
  { id: "padre", label: "Padre" },
  { id: "madre", label: "Madre" },
  { id: "figlio", label: "Figlio" },
  { id: "fratello", label: "Fratello" },
  { id: "sorella", label: "Sorella" },
] as const;

/** L'etichetta INVERSA si deriva a video: a DB la riga è una sola (C4). */
const INVERSA: Record<string, string> = {
  tutore_legale: "tutelato",
  padre: "figlio",
  madre: "figlio",
  figlio: "genitore",
  fratello: "fratello",
  sorella: "sorella",
};

const dritto = (tipo: string) => tipo.replace(/_/g, " ");

export interface RigaConsenso {
  id: string;
  tipo: string;
  azione: string;
  canali: string[] | null;
  modalita: string | null;
  /**
   * M1 §5 vuole il mastro leggibile come «dato il 12/03, penna, informativa v2».
   * La colonna c'è e qui si mostra quando è valorizzata, ma **nessuna schermata
   * la scrive ancora**: da dove venga la versione corrente dell'informativa (un
   * parametro di negozio? una costante di prodotto?) la spec non lo dice, e non
   * è una cosa da decidere da soli. Punto aperto segnalato nella PR.
   */
  versione_informativa: string | null;
  avvenuto_il: string;
}

export interface RigaRelazione {
  id: string;
  tipo: string;
  /** L'ALTRO capo della riga, quello da mostrare e da linkare. */
  altroId: string;
  altroNome: string;
  /** true se la riga parte da un ALTRO cliente e punta a questo: si legge al contrario. */
  inversa: boolean;
}

export interface ClienteMini {
  id: string;
  nome: string;
  cognome: string;
}

export function PermessiCliente({
  clienteId,
  consensi,
  relazioni,
  candidati,
  consensoMarketing,
  canaliAttivi,
  anonimizzato,
}: {
  clienteId: string;
  consensi: RigaConsenso[];
  relazioni: RigaRelazione[];
  candidati: ClienteMini[];
  consensoMarketing: boolean;
  canaliAttivi: string[] | null;
  anonimizzato: boolean;
}) {
  return (
    <Card className="mb-6 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">Permessi</p>

      <MastroConsensi
        clienteId={clienteId}
        consensi={consensi}
        consensoMarketing={consensoMarketing}
        canaliAttivi={canaliAttivi}
        anonimizzato={anonimizzato}
      />

      <Relazioni
        clienteId={clienteId}
        relazioni={relazioni}
        candidati={candidati}
        anonimizzato={anonimizzato}
      />

      {!anonimizzato && <EliminazioneDefinitiva clienteId={clienteId} />}
    </Card>
  );
}

/* ── Il mastro (C3) ─────────────────────────────────────────────────── */

function MastroConsensi({
  clienteId,
  consensi,
  consensoMarketing,
  canaliAttivi,
  anonimizzato,
}: {
  clienteId: string;
  consensi: RigaConsenso[];
  consensoMarketing: boolean;
  canaliAttivi: string[] | null;
  anonimizzato: boolean;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [confermaRevoca, setConfermaRevoca] = useState(false);
  const [canali, setCanali] = useState<string[]>([]);
  const [modalita, setModalita] = useState("penna");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // La cache in una riga sola: se non c'è mai stato un evento è «non raccolto»,
  // che è diverso da «no» (revocato). La distinzione conta al banco.
  const maiChiesto = consensi.every((c) => c.tipo !== "marketing");
  const statoMarketing = consensoMarketing
    ? `sì${canaliAttivi?.length ? ` · ${canaliAttivi.join(", ")}` : ""}`
    : maiChiesto
      ? "non raccolto"
      : "no";

  async function salva() {
    setBusy(true);
    setErr(null);
    const r = await registraConsenso(clienteId, {
      tipo: "marketing",
      azione: "dato",
      canali,
      modalita: modalita as "penna" | "digitale",
    });
    setBusy(false);
    if ("errore" in r) setErr(r.errore);
    else {
      setAperto(false);
      setCanali([]);
      router.refresh();
    }
  }

  async function revoca() {
    setBusy(true);
    setErr(null);
    const r = await revocaMarketing(clienteId);
    setBusy(false);
    if (r?.errore) setErr(r.errore);
    else {
      setConfermaRevoca(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-inchiostro">
          <span className="font-semibold">Marketing:</span>{" "}
          <span className={consensoMarketing ? "text-verde" : "text-soft"}>{statoMarketing}</span>
        </p>
        {!anonimizzato && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={BTN} onClick={() => setAperto((v) => !v)}>
              Registra consenso
            </button>
            {consensoMarketing && (
              <button
                type="button"
                disabled={busy}
                className={BTN_CHIARO}
                onClick={() => setConfermaRevoca(true)}
              >
                Revoca comunicazioni
              </button>
            )}
          </div>
        )}
      </div>

      {confermaRevoca && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-linea bg-carta px-3 py-2">
          <p className="text-xs text-inchiostro">
            Da adesso niente promozioni. Gli avvisi operativi («i suoi occhiali
            sono pronti») restano leciti.
          </p>
          <button type="button" disabled={busy} className={BTN} onClick={revoca}>
            {busy ? "…" : "Conferma revoca"}
          </button>
          <button type="button" className={BTN_CHIARO} onClick={() => setConfermaRevoca(false)}>
            Annulla
          </button>
        </div>
      )}

      {aperto && (
        <div className="space-y-3 rounded-xl border border-linea bg-carta p-3">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold uppercase tracking-wide text-soft">
              Canali consentiti
            </legend>
            {CANALI.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-inchiostro">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#A67C42]"
                  checked={canali.includes(c.id)}
                  onChange={(e) =>
                    setCanali((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <Field label="Modalità" hint="Come è stata raccolta la firma.">
            <select
              value={modalita}
              onChange={(e) => setModalita(e.target.value)}
              className={inputCls}
            >
              <option value="penna">Penna</option>
              <option value="digitale">Digitale</option>
            </select>
          </Field>
          <button type="button" disabled={busy || canali.length === 0} className={BTN} onClick={salva}>
            {busy ? "…" : "Salva consenso"}
          </button>
        </div>
      )}

      {/* Il mastro: FATTI, non stato. La cache è la riga qui sopra. */}
      {consensi.length > 0 && (
        <ul className="divide-y divide-linea rounded-xl border border-linea">
          {consensi.map((c) => (
            <li key={c.id} className="px-3 py-2 text-xs text-soft">
              <span className="text-inchiostro">
                Consenso {c.tipo === "marketing" ? "marketing" : "dati sanitari"}
              </span>{" "}
              {c.azione === "dato" ? "dato" : "revocato"} il{" "}
              {/* `fmtData`, come tutto il resto dell'app: due formati di data
                  nella STESSA schermata (qui 06/08/2026, nel riquadro Privacy
                  6 ago 2026) facevano sembrare due cose diverse due date. */}
              {fmtData(c.avvenuto_il)}
              {c.modalita ? ` · ${c.modalita}` : ""}
              {c.canali?.length ? ` · ${c.canali.join(", ")}` : ""}
              {c.versione_informativa ? ` · informativa ${c.versione_informativa}` : ""}
            </li>
          ))}
        </ul>
      )}
      <Errore msg={err} />
    </div>
  );
}

/* ── Relazioni (C4) ─────────────────────────────────────────────────── */

function Relazioni({
  clienteId,
  relazioni,
  candidati,
  anonimizzato,
}: {
  clienteId: string;
  relazioni: RigaRelazione[];
  candidati: ClienteMini[];
  anonimizzato: boolean;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [relativo, setRelativo] = useState("");
  const [tipo, setTipo] = useState("tutore_legale");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function collega() {
    setBusy(true);
    setErr(null);
    const r = await creaRelazione(clienteId, relativo, tipo);
    setBusy(false);
    if (r?.errore) setErr(r.errore);
    else {
      setAperto(false);
      setRelativo("");
      router.refresh();
    }
  }

  async function stacca(id: string) {
    setBusy(true);
    setErr(null);
    const r = await eliminaRelazione(id, clienteId);
    setBusy(false);
    if (r?.errore) setErr(r.errore);
    else router.refresh();
  }

  return (
    <div className="space-y-2 border-t border-linea pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-inchiostro">Famiglia e tutela</p>
        {/* Su un cliente anonimizzato non si ricollega nessuno: l'anonimizzazione
            cancella le relazioni apposta, perché de-anonimizzano per prossimità
            (C1). Ridarne una qui rimetterebbe in piedi ciò che è stato tolto. */}
        {!anonimizzato && (
          <button type="button" className={BTN_CHIARO} onClick={() => setAperto((v) => !v)}>
            Aggiungi relazione
          </button>
        )}
      </div>

      {aperto && !anonimizzato && (
        <div className="space-y-3 rounded-xl border border-linea bg-carta p-3">
          <SceltaPersona candidati={candidati} onScegli={setRelativo} />
          <Field label="Tipo di relazione">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TIPI_RELAZIONE.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" disabled={busy || !relativo} className={BTN} onClick={collega}>
            {busy ? "…" : "Collega"}
          </button>
        </div>
      )}

      {relazioni.length > 0 ? (
        <ul className="divide-y divide-linea rounded-xl border border-linea">
          {relazioni.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              {/* Una riga sola a DB: qui si legge dal lato giusto (C4). */}
              <Link href={`/clienti/${r.altroId}`} className="text-inchiostro hover:underline">
                <span className="font-semibold">{r.altroNome}</span>{" "}
                <span className="text-soft">— {r.inversa ? INVERSA[r.tipo] ?? dritto(r.tipo) : dritto(r.tipo)}</span>
              </Link>
              <button type="button" disabled={busy} className={BTN_CHIARO} onClick={() => stacca(r.id)}>
                Stacca
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-faint">Nessuna relazione registrata.</p>
      )}
      <Errore msg={err} />
    </div>
  );
}

/**
 * Scelta della persona da collegare: si scrive un pezzo di nome e si sceglie
 * dalla lista. `candidati` arriva già limitato dal server (vedi la scheda): la
 * ricerca sul registro intero è lavoro di M1 completo, non della UI minima.
 */
function SceltaPersona({
  candidati,
  onScegli,
}: {
  candidati: ClienteMini[];
  onScegli: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [aperta, setAperta] = useState(false);

  const cerca = q.trim().toLowerCase();
  const trovati = aperta && cerca
    ? candidati
        .filter((c) => `${c.nome} ${c.cognome}`.toLowerCase().includes(cerca))
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-1">
      <Field label="Persona collegata">
        <input
          role="combobox"
          aria-expanded={trovati.length > 0}
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAperta(true);
            onScegli("");
          }}
          className={inputCls}
          placeholder="Scrivi nome o cognome…"
        />
      </Field>
      {trovati.length > 0 && (
        // `role="option"` sta sull'elemento che si preme, non su un guscio che
        // lo contiene: altrimenti l'opzione non è né focalizzabile né premibile
        // da tastiera, e i lettori di schermo annunciano due cose diverse.
        <div role="listbox" className="divide-y divide-linea rounded-xl border border-linea bg-white">
          {trovati.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              className="block w-full px-3 py-2 text-left text-sm text-inchiostro hover:bg-carta"
              onClick={() => {
                onScegli(c.id);
                setQ(`${c.nome} ${c.cognome}`);
                setAperta(false);
              }}
            >
              {c.nome} {c.cognome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Eliminazione definitiva (C1) ───────────────────────────────────── */

function EliminazioneDefinitiva({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [conferma, setConferma] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function esegui() {
    setBusy(true);
    setErr(null);
    const r = await anonimizzaCliente(clienteId);
    setBusy(false);
    if (r?.errore) setErr(r.errore);
    else {
      setAperto(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2 border-t border-linea pt-4">
      <button type="button" className={BTN_ROSSO} onClick={() => setAperto((v) => !v)}>
        Eliminazione definitiva
      </button>

      {aperto && (
        <div className="space-y-3 rounded-xl border border-rosso/30 bg-rosso-soft/40 p-3">
          {/* «Possibile, non comodissima» (M1 f1e.2): la conferma è forte apposta. */}
          <p className="text-xs text-inchiostro">
            I dati personali spariscono per sempre. Vendite, ordini e movimenti
            <strong> restano</strong>: sono fatti aziendali.
          </p>
          <Field label="Scrivi ELIMINA per confermare">
            <input
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              className={inputCls}
              placeholder="ELIMINA"
            />
          </Field>
          <button
            type="button"
            disabled={busy || conferma !== "ELIMINA"}
            className={BTN_ROSSO}
            onClick={esegui}
          >
            {busy ? "…" : "Anonimizza definitivamente"}
          </button>
          <Errore msg={err} />
        </div>
      )}
    </div>
  );
}
