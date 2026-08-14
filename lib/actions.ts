"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  PrismaBase,
  RigaOrdineLac,
  Json,
  OrdineLacUpdate,
  OrdineOcchialiUpdate,
  MovimentoMagazzinoRow,
  RigaVendita,
  PagamentoVendita,
  Fonte,
} from "@/lib/database.types";
import { ivaScorporo } from "@/components/CassaUI";
import {
  sistemaPerMetodo,
  caparreSenzaMetodo,
  contatoriCaparre,
  NOME_CAPARRA,
} from "@/lib/cassa-calcoli";
import { istanteRomaISO } from "@/lib/utils";
import { richiedi, esitoDaErrore } from "@/lib/permessi";

/* ── Helper ────────────────────────────────────────────────────────── */

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function num(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function numeriCsv(fd: FormData, k: string): number[] {
  const valore = str(fd, k);
  if (!valore) return [];
  return valore
    .split(",")
    .map((parte) => Number(parte.trim().replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

function jsonDaForm(fd: FormData, k: string): Json | null {
  const valore = str(fd, k);
  if (!valore) return null;
  try {
    const letto: unknown = JSON.parse(valore);
    return letto as Json;
  } catch {
    return null;
  }
}

/* ── Onboarding ────────────────────────────────────────────────────── */

export async function completaOnboarding(
  _prev: { errore: string } | null,
  formData: FormData
): Promise<{ errore: string } | null> {
  const supabase = await createClient();

  const nomeAzienda = str(formData, "nome_azienda");
  const slug = str(formData, "slug");
  const nomeUtente = str(formData, "nome_utente");

  if (!nomeAzienda || !slug || !nomeUtente) {
    return { errore: "Compila tutti i campi." };
  }
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return { errore: "Lo slug può contenere solo lettere minuscole, numeri e trattini (min 3 caratteri)." };
  }

  const { error } = await supabase.rpc("crea_azienda_con_titolare", {
    p_nome_azienda: nomeAzienda,
    p_slug: slug,
    p_nome_utente: nomeUtente,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { errore: `Lo slug "${slug}" è già in uso: scegline un altro.` };
    }
    if (error.message.includes("UTENTE_GIA_REGISTRATO")) {
      redirect("/dashboard");
    }
    return { errore: `Qualcosa è andato storto: ${error.message}` };
  }

  redirect("/dashboard");
}

/* ── Clienti ───────────────────────────────────────────────────────── */

function clienteDaForm(fd: FormData) {
  // B1 · blocco P.IVA → `dati_fatturazione` (jsonb). Se il negozio non compila
  // nulla la colonna resta null: «non fattura a azienda» ≠ «azienda vuota».
  const ragioneSociale = str(fd, "ragione_sociale");
  const pivaAzienda = str(fd, "piva_azienda")?.toUpperCase() ?? null;
  const codiceSdi = str(fd, "codice_sdi")?.toUpperCase() ?? null;
  const datiFatturazione =
    ragioneSociale || pivaAzienda || codiceSdi
      ? {
          ragione_sociale: ragioneSociale,
          cf_piva: pivaAzienda,
          codice_sdi: codiceSdi,
        }
      : null;

  return {
    nome: str(fd, "nome") ?? "",
    cognome: str(fd, "cognome") ?? "",
    secondo_nome: str(fd, "secondo_nome"),
    data_nascita: str(fd, "data_nascita"),
    sesso: (str(fd, "sesso") as "M" | "F" | null) ?? null,
    codice_fiscale: str(fd, "codice_fiscale")?.toUpperCase() ?? null,
    email: str(fd, "email"),
    telefono: str(fd, "telefono"),
    telefono_casa: str(fd, "telefono_casa"),
    telefono_lavoro: str(fd, "telefono_lavoro"),
    canale_preferito: (str(fd, "canale_preferito") as
      | "telefono" | "whatsapp" | "sms" | "email" | "cartaceo" | null) ?? null,
    non_contattare: fd.get("non_contattare") === "on",
    indirizzo: str(fd, "indirizzo"),
    indirizzo2: str(fd, "indirizzo2"),
    citta: str(fd, "citta"),
    cap: str(fd, "cap"),
    provincia: str(fd, "provincia")?.toUpperCase() ?? null,
    nazione: str(fd, "nazione"),
    lingua: str(fd, "lingua"),
    fonte: (str(fd, "fonte") ?? "banco") as Fonte,
    // M1 §2: null = DA RILEVARE · la voce NESSUNA = chiesto, non ne ha.
    assicurazione_id: str(fd, "assicurazione_id"),
    dati_fatturazione: datiFatturazione,
    note: str(fd, "note"),
  };
  // NB · `consenso_marketing` e `consenso_canali` NON stanno qui: sono la CACHE
  // dell'ultimo evento del mastro e il contratto C3 vieta di scriverla
  // direttamente («la cache non si scrive MAI direttamente, solo l'azione del
  // mastro»). Si raccoglie e si revoca dalla sezione Permessi della scheda.
  //
  // NB · `tutore_legale` NON sta qui, e la ragione è la stessa in forma diversa
  // (M1 §10, Annot. 3): il campo è deprecato e la scheda lo mostra in SOLA
  // LETTURA come storico. Se restasse in questa mappa, il form non lo
  // manderebbe più e `str()` tornerebbe null: ogni salvataggio della scheda
  // CANCELLEREBBE lo storico, in silenzio. Il valore si tocca solo col travaso
  // assistito verso le relazioni vere (post-C0, TODO-regia).
}

export async function creaCliente(
  _prev: { errore: string } | null,
  formData: FormData
): Promise<{ errore: string } | null> {
  const supabase = await createClient();
  const dati = clienteDaForm(formData);

  if (!dati.nome || !dati.cognome) {
    return { errore: "Nome e cognome sono obbligatori." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Sessione scaduta: rifai il login." };

  const { data: utente } = await supabase
    .from("utenti")
    .select("azienda_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!utente) return { errore: "Profilo non trovato: rifai il login." };

  const { data, error } = await supabase
    .from("clienti")
    .insert({ ...dati, azienda_id: utente.azienda_id })
    .select("id")
    .single();

  if (error) return { errore: `Salvataggio non riuscito: ${error.message}` };

  revalidatePath("/clienti");
  redirect(`/clienti/${data.id}`);
}

export async function aggiornaCliente(
  clienteId: string,
  _prev: { errore: string } | null,
  formData: FormData
): Promise<{ errore: string } | null> {
  const supabase = await createClient();
  const dati = clienteDaForm(formData);

  if (!dati.nome || !dati.cognome) {
    return { errore: "Nome e cognome sono obbligatori." };
  }

  const { error } = await supabase
    .from("clienti")
    .update(dati)
    .eq("id", clienteId);

  if (error) return { errore: `Salvataggio non riuscito: ${error.message}` };

  revalidatePath(`/clienti/${clienteId}`);
  revalidatePath("/clienti");
  redirect(`/clienti/${clienteId}`);
}

/**
 * Registra il consenso ai DATI SANITARI raccolto al banco (anche su carta, con
 * data retrodatabile) — audit A6, gate delle prescrizioni.
 *
 * B1 · qui è rimasto SOLO il sanitario. Il marketing è passato al mastro
 * (`registraConsenso` / `revocaMarketing`): il contratto C3 dice che
 * `consenso_marketing` + `consenso_canali` sono la proiezione dell'ultimo evento
 * e «la cache non si scrive MAI direttamente». Per i dati sanitari C3 prevede
 * NESSUNA cache e un evento legato alla prescrizione: finché la raccolta al
 * banco è slegata dalla ricetta resta questa colonna della Fase 4d, che il
 * mastro non può rappresentare senza `prescrizione_id`.
 */
export async function registraConsensi(
  clienteId: string,
  _prev: { errore: string } | null,
  formData: FormData
): Promise<{ errore: string } | null> {
  const supabase = await createClient();
  const sanitario = formData.get("consenso_dati_sanitari") === "on";
  if (!sanitario) {
    return { errore: "Spunta il consenso da registrare." };
  }
  const d = str(formData, "data_sanitario");
  const ts = d ? new Date(`${d}T12:00:00`).toISOString() : new Date().toISOString();

  const { error } = await supabase
    .from("clienti")
    .update({ consenso_dati_sanitari: ts, consenso_sanitario_il: ts })
    .eq("id", clienteId);
  if (error) return { errore: `Consenso non salvato: ${error.message}` };

  revalidatePath(`/clienti/${clienteId}`);
  return null;
}

/* ── Prescrizioni ──────────────────────────────────────────────────── */
// La scheda unica B2 vive in `lib/prescrizioni-actions.ts`: questa azione
// legacy non rappresentava sezioni miste, consenso per-Rx o LAC definitiva.

/* ── Ordini & Buste ────────────────────────────────────────────────── */

type Esito = { errore: string } | null;

/** Profilo dell'operatore corrente (id + azienda). Pattern comune alle action. */
async function profiloCorrente(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ id: string; azienda_id: string } | { errore: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Sessione scaduta: rifai il login." };

  const { data: utente } = await supabase
    .from("utenti")
    .select("id, azienda_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!utente) return { errore: "Profilo non trovato: rifai il login." };
  return utente;
}

/** Data italiana "gg/mm/aaaa" per le note. */
function dataIt(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Appende una riga "— gg/mm/aaaa: testo" alle note esistenti. */
function appendiNota(note: string | null, riga: string): string {
  return note && note.trim() !== "" ? `${note}\n${riga}` : riga;
}

/** Arrotonda a 2 decimali (colonne numeric(10,2)). */
function euro2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Creazione ordine LAC ─────────────────────────────────────────────

export async function creaOrdineLac(
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();

  const clienteId = str(formData, "cliente_id");
  if (!clienteId) return { errore: "Seleziona un cliente prima di creare l'ordine." };

  // Righe: arrivano come JSON in un hidden field, si validano qui (§2.9).
  let righeRaw: unknown;
  try {
    righeRaw = JSON.parse(str(formData, "righe") ?? "[]");
  } catch {
    return { errore: "Righe non valide." };
  }
  if (!Array.isArray(righeRaw) || righeRaw.length === 0) {
    return { errore: "Aggiungi almeno una riga all'ordine." };
  }

  const righe: RigaOrdineLac[] = [];
  for (const r of righeRaw as Record<string, unknown>[]) {
    const descrizione = typeof r.descrizione === "string" ? r.descrizione.trim() : "";
    if (descrizione === "") return { errore: "Ogni riga deve avere una descrizione." };

    const occhio =
      r.occhio === "OD" || r.occhio === "OS" ? (r.occhio as "OD" | "OS") : null;
    const quantita = Number(r.quantita);
    if (!Number.isFinite(quantita) || quantita < 1) {
      return { errore: "La quantità di ogni riga deve essere almeno 1." };
    }
    const prezzo = Number(r.prezzo);
    if (!Number.isFinite(prezzo) || prezzo < 0) {
      return { errore: "Il prezzo di ogni riga non può essere negativo." };
    }

    const p = (r.parametri ?? {}) as Record<string, unknown>;
    const numOrNull = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    righe.push({
      prodotto_id: typeof r.prodotto_id === "string" ? r.prodotto_id : null,
      descrizione,
      occhio,
      parametri: {
        sfero: numOrNull(p.sfero),
        cilindro: numOrNull(p.cilindro),
        asse: numOrNull(p.asse),
        raggio: numOrNull(p.raggio),
        diametro: numOrNull(p.diametro),
        addizione: numOrNull(p.addizione),
      },
      quantita: Math.round(quantita),
      prezzo: euro2(prezzo),
    });
  }

  // Il totale lo decide SEMPRE il server (§2.9).
  const totale = euro2(righe.reduce((s, r) => s + r.quantita * r.prezzo, 0));
  const acconto = Math.max(0, num(formData, "acconto") ?? 0);

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { data: numero, error: errNum } = await supabase.rpc("prossimo_numero", {
    p_prefisso: "OL",
  });
  if (errNum || !numero) {
    return { errore: `Numerazione non riuscita: ${errNum?.message ?? "riprova"}` };
  }

  const { data, error } = await supabase
    .from("ordini_lac")
    .insert({
      azienda_id: prof.azienda_id,
      cliente_id: clienteId,
      prescrizione_id: str(formData, "prescrizione_id"),
      numero,
      fonte: "banco",
      stato: "da_ordinare",
      righe: righe as unknown as Json,
      totale,
      acconto,
      data_arrivo_prevista: str(formData, "data_arrivo_prevista"),
      note: str(formData, "note"),
    })
    .select("id")
    .single();

  if (error) return { errore: `Creazione non riuscita: ${error.message}` };

  revalidatePath("/ordini");
  revalidatePath(`/clienti/${clienteId}`);
  redirect(`/ordini/lac/${data.id}`);
}

// ── Creazione busta ──────────────────────────────────────────────────

const TIPI_LAVORO = [
  "occhiale_completo",
  "solo_lenti",
  "solo_montatura",
  "montatura_cliente",
] as const;
const LENTE_TIPI = ["monofocale", "progressiva", "bifocale", "office"] as const;

export async function creaBusta(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();

  const clienteId = str(formData, "cliente_id");
  if (!clienteId) return { errore: "Seleziona un cliente prima di creare la busta." };

  const tipoLavoroRaw = str(formData, "tipo_lavoro") ?? "occhiale_completo";
  const tipo_lavoro = (TIPI_LAVORO as readonly string[]).includes(tipoLavoroRaw)
    ? (tipoLavoroRaw as (typeof TIPI_LAVORO)[number])
    : "occhiale_completo";

  const statoRaw = str(formData, "stato") ?? "lavorazione";
  if (statoRaw !== "lavorazione" && statoRaw !== "preventivo") {
    return { errore: "Stato iniziale non valido." };
  }

  const lenteTipoRaw = str(formData, "lente_tipo");
  const lente_tipo = (LENTE_TIPI as readonly string[]).includes(lenteTipoRaw ?? "")
    ? (lenteTipoRaw as (typeof LENTE_TIPI)[number])
    : null;

  // Centratura: facoltativa, ma se compilata deve stare nel range (§2.7).
  const centro = (
    campo: string,
    min: number,
    max: number,
    etichetta: string
  ): { v: number | null } | { errore: string } => {
    const v = num(formData, campo);
    if (v === null) return { v: null };
    if (v < min || v > max) {
      return { errore: `${etichetta} fuori range (${min}–${max} mm).` };
    }
    return { v };
  };
  const od_dnp = centro("od_dnp", 20, 40, "DNP OD");
  const os_dnp = centro("os_dnp", 20, 40, "DNP OS");
  const od_altezza = centro("od_altezza", 10, 35, "Altezza OD");
  const os_altezza = centro("os_altezza", 10, 35, "Altezza OS");
  for (const c of [od_dnp, os_dnp, od_altezza, os_altezza]) {
    if ("errore" in c) return c;
  }

  const prezzo_montatura = Math.max(0, num(formData, "prezzo_montatura") ?? 0);
  const prezzo_lenti = Math.max(0, num(formData, "prezzo_lenti") ?? 0);
  const prezzo_extra = Math.max(0, num(formData, "prezzo_extra") ?? 0);
  const sconto = Math.max(0, num(formData, "sconto") ?? 0);

  // Totale deciso dal server (§2.10). saldo è colonna generata: NON si scrive.
  const totale = euro2(prezzo_montatura + prezzo_lenti + prezzo_extra - sconto);
  let acconto = num(formData, "acconto") ?? 0;
  if (acconto < 0) acconto = 0;
  if (acconto > totale) acconto = totale;

  // La caparra nasce con un metodo (§2.1 Fase 4c): se c'è acconto, serve il metodo.
  const accontoMetodo = str(formData, "acconto_metodo");
  if (acconto > 0 && !accontoMetodo) {
    return { errore: "Indica con quale metodo hai incassato la caparra." };
  }

  // Garanzia tipizzata (B1): servizio (default) o polizza di compagnia.
  const garanziaTipoRaw = str(formData, "garanzia_tipo");
  const garanzia_tipo = garanziaTipoRaw === "polizza" ? "polizza" : "servizio";

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { data: numero, error: errNum } = await supabase.rpc("prossimo_numero", {
    p_prefisso: "BL",
  });
  if (errNum || !numero) {
    return { errore: `Numerazione non riuscita: ${errNum?.message ?? "riprova"}` };
  }

  const { data, error } = await supabase
    .from("ordini_occhiali")
    .insert({
      azienda_id: prof.azienda_id,
      cliente_id: clienteId,
      prescrizione_id: str(formData, "prescrizione_id"),
      numero,
      fonte: "banco",
      stato: statoRaw,
      tipo_lavoro,
      montatura_marca: str(formData, "montatura_marca"),
      montatura_modello: str(formData, "montatura_modello"),
      montatura_colore: str(formData, "montatura_colore"),
      montatura_calibro: str(formData, "montatura_calibro"),
      montatura_upc: str(formData, "montatura_upc"),
      prezzo_montatura,
      lente_tipo,
      lente_materiale: str(formData, "lente_materiale"),
      lente_indice: str(formData, "lente_indice"),
      trattamenti: formData.getAll("trattamenti").filter((t) => typeof t === "string") as string[],
      prezzo_lenti,
      od_dnp: (od_dnp as { v: number | null }).v,
      os_dnp: (os_dnp as { v: number | null }).v,
      od_altezza: (od_altezza as { v: number | null }).v,
      os_altezza: (os_altezza as { v: number | null }).v,
      garanzia: str(formData, "garanzia"),
      garanzia_tipo,
      prezzo_extra,
      sconto,
      totale,
      acconto,
      acconto_metodo: acconto > 0 ? accontoMetodo : null,
      acconto_incassato_il: acconto > 0 ? new Date().toISOString() : null,
      laboratorio: str(formData, "laboratorio"),
      data_promessa: str(formData, "data_promessa"),
      note: str(formData, "note"),
    })
    .select("id")
    .single();

  if (error) return { errore: `Creazione non riuscita: ${error.message}` };

  revalidatePath("/ordini");
  revalidatePath(`/clienti/${clienteId}`);
  redirect(`/ordini/buste/${data.id}`);
}

// ── Eventi ordine LAC (macchina a stati §2.3) ────────────────────────

export async function eventoOrdineLac(
  id: string,
  evento: "ordina" | "arriva" | "avvisa" | "consegna" | "annulla",
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();

  const { data: ordine } = await supabase
    .from("ordini_lac")
    .select("stato, note, righe, numero, azienda_id")
    .eq("id", id)
    .maybeSingle();
  if (!ordine) return { errore: "Ordine non trovato." };

  const stato = ordine.stato;
  const patch: OrdineLacUpdate = {};

  switch (evento) {
    case "ordina":
      if (stato !== "da_ordinare") return { errore: `Transizione non valida da ${stato}.` };
      patch.stato = "ordinato";
      break;
    case "arriva":
      if (stato !== "ordinato") return { errore: `Transizione non valida da ${stato}.` };
      patch.stato = "arrivato";
      break;
    case "avvisa":
      if (stato !== "arrivato") return { errore: `Transizione non valida da ${stato}.` };
      patch.avvisato_il = new Date().toISOString();
      break;
    case "consegna":
      if (stato !== "arrivato") return { errore: `Transizione non valida da ${stato}.` };
      patch.stato = "consegnato";
      patch.data_consegna = new Date().toISOString();
      break;
    case "annulla": {
      if (!["da_ordinare", "ordinato", "arrivato"].includes(stato)) {
        return { errore: `Transizione non valida da ${stato}.` };
      }
      const motivo = str(formData, "motivo");
      if (!motivo) return { errore: "Indica un motivo per l'annullamento." };
      patch.stato = "annullato";
      patch.note = appendiNota(ordine.note, `— Annullato ${dataIt()}: ${motivo}`);
      break;
    }
  }

  const { error } = await supabase.from("ordini_lac").update(patch).eq("id", id);
  if (error) return { errore: `Operazione non riuscita: ${error.message}` };

  // Scarico automatico alla consegna (§2.8): una riga con prodotto_id → un
  // movimento ordine_cliente. Prodotto rimosso: si salta, non blocca.
  if (evento === "consegna") {
    let utenteId: string | null = null;
    const prof = await profiloCorrente(supabase);
    if (!("errore" in prof)) utenteId = prof.id;

    const righe = (Array.isArray(ordine.righe) ? ordine.righe : []) as RigaOrdineLac[];
    for (const r of righe) {
      if (!r.prodotto_id) continue;
      const q = Math.round(Number(r.quantita) || 0);
      if (q < 1) continue;
      await supabase.from("movimenti_magazzino").insert({
        azienda_id: ordine.azienda_id,
        prodotto_id: r.prodotto_id,
        utente_id: utenteId,
        tipo: "ordine_cliente",
        quantita: -q,
        riferimento: ordine.numero,
      });
    }
    revalidatePath("/magazzino");
  }

  revalidatePath("/ordini");
  revalidatePath(`/ordini/lac/${id}`);
  return null;
}

// ── Eventi busta (macchina a stati §2.4) ─────────────────────────────

export async function eventoBusta(
  id: string,
  evento: "conferma" | "arriva" | "ispeziona" | "avvisa" | "consegna" | "annulla" | "remake",
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();

  const { data: busta } = await supabase
    .from("ordini_occhiali")
    .select("stato, note, totale, acconto, acconto_incassato_il")
    .eq("id", id)
    .maybeSingle();
  if (!busta) return { errore: "Busta non trovata." };

  const stato = busta.stato;
  const patch: OrdineOcchialiUpdate = {};

  switch (evento) {
    case "conferma": {
      if (stato !== "preventivo") return { errore: `Transizione non valida da ${stato}.` };
      let acconto = num(formData, "acconto") ?? 0;
      if (acconto < 0) acconto = 0;
      if (acconto > busta.totale) acconto = busta.totale;
      patch.stato = "lavorazione";
      patch.acconto = acconto;
      // La caparra entra in cassa alla conferma: metodo obbligatorio, data la prima volta (§2.1).
      if (acconto > 0) {
        const accontoMetodo = str(formData, "acconto_metodo");
        if (!accontoMetodo) return { errore: "Indica con quale metodo hai incassato la caparra." };
        patch.acconto_metodo = accontoMetodo;
        if (!busta.acconto_incassato_il) patch.acconto_incassato_il = new Date().toISOString();
      }
      break;
    }
    case "arriva":
      if (stato !== "lavorazione") return { errore: `Transizione non valida da ${stato}.` };
      patch.stato = "arrivata";
      break;
    case "ispeziona": {
      if (stato !== "arrivata") return { errore: `Transizione non valida da ${stato}.` };
      const prof = await profiloCorrente(supabase);
      if ("errore" in prof) return prof;
      patch.stato = "pronta";
      patch.ispezionata_da = prof.id;
      patch.ispezionata_il = new Date().toISOString();
      break;
    }
    case "avvisa":
      if (stato !== "pronta") return { errore: `Transizione non valida da ${stato}.` };
      patch.avvisato_il = new Date().toISOString();
      break;
    case "consegna":
      if (stato !== "pronta") return { errore: `Transizione non valida da ${stato}.` };
      patch.stato = "consegnata";
      patch.data_consegna = new Date().toISOString();
      break;
    case "annulla": {
      if (!["preventivo", "lavorazione", "arrivata", "pronta"].includes(stato)) {
        return { errore: `Transizione non valida da ${stato}.` };
      }
      const motivo = str(formData, "motivo");
      if (!motivo) return { errore: "Indica un motivo per l'annullamento." };
      patch.stato = "annullata";
      patch.note = appendiNota(busta.note, `— Annullata ${dataIt()}: ${motivo}`);
      break;
    }
    case "remake": {
      if (!["arrivata", "pronta"].includes(stato)) {
        return { errore: `Transizione non valida da ${stato}.` };
      }
      const motivo = str(formData, "motivo");
      if (!motivo) return { errore: "Indica un motivo per il remake." };
      patch.stato = "lavorazione";
      patch.ispezionata_da = null;
      patch.ispezionata_il = null;
      patch.avvisato_il = null;
      patch.note = appendiNota(busta.note, `— Remake ${dataIt()}: ${motivo}`);
      break;
    }
  }

  const { error } = await supabase.from("ordini_occhiali").update(patch).eq("id", id);
  if (error) return { errore: `Operazione non riuscita: ${error.message}` };

  revalidatePath("/ordini");
  revalidatePath(`/ordini/buste/${id}`);
  return null;
}

// ── Nota rapida su un ordine ─────────────────────────────────────────

export async function aggiungiNotaOrdine(
  tipo: "lac" | "buste",
  id: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const testo = str(formData, "testo");
  if (!testo) return { errore: "Scrivi qualcosa prima di aggiungere la nota." };

  const riga = `— ${dataIt()}: ${testo}`;

  if (tipo === "lac") {
    const { data: ordine } = await supabase
      .from("ordini_lac")
      .select("note")
      .eq("id", id)
      .maybeSingle();
    if (!ordine) return { errore: "Ordine non trovato." };
    const { error } = await supabase
      .from("ordini_lac")
      .update({ note: appendiNota(ordine.note, riga) })
      .eq("id", id);
    if (error) return { errore: `Nota non salvata: ${error.message}` };
  } else {
    const { data: ordine } = await supabase
      .from("ordini_occhiali")
      .select("note")
      .eq("id", id)
      .maybeSingle();
    if (!ordine) return { errore: "Ordine non trovato." };
    const { error } = await supabase
      .from("ordini_occhiali")
      .update({ note: appendiNota(ordine.note, riga) })
      .eq("id", id);
    if (error) return { errore: `Nota non salvata: ${error.message}` };
  }

  revalidatePath(`/ordini/${tipo}/${id}`);
  return null;
}

/* ── Magazzino: prodotti ───────────────────────────────────────────── */

const TIPI_PRODOTTO = [
  "lac",
  "soluzione",
  "montatura",
  "sole",
  "lente",
  "accessorio",
  "servizio",
] as const;

function prodottoDaForm(fd: FormData) {
  const tipoRaw = str(fd, "tipo") ?? "accessorio";
  const tipo = (TIPI_PRODOTTO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_PRODOTTO)[number])
    : "accessorio";

  // Parametri per-tipo nel jsonb (§2.5 Fase 4b); per gli altri tipi resta {}.
  const parametri: Record<string, unknown> =
    tipo === "lac"
      ? {
          raggio: num(fd, "par_raggio"),
          diametro: num(fd, "par_diametro"),
          confezione: str(fd, "par_confezione"),
        }
      : tipo === "montatura" || tipo === "sole"
        ? {
            calibro: num(fd, "par_calibro"),
            ponte: num(fd, "par_ponte"),
            asta: num(fd, "par_asta"),
            colore_codice: str(fd, "par_colore_codice"),
            colore_nome: str(fd, "par_colore_nome"),
            materiale: str(fd, "par_materiale"),
          }
        : {};

  // Ricambio LAC → colonna dedicata (raffina l'esaurimento richiami).
  const ricambio_giorni = tipo === "lac" ? num(fd, "ricambio_giorni") : null;

  return {
    tipo,
    marca: str(fd, "marca"),
    nome: str(fd, "nome") ?? "",
    descrizione: str(fd, "descrizione"),
    sku: str(fd, "sku"),
    fornitore: str(fd, "fornitore"),
    prezzo: Math.max(0, num(fd, "prezzo") ?? 0),
    costo: num(fd, "costo"),
    scorta_minima: Math.max(0, Math.round(num(fd, "scorta_minima") ?? 0)),
    visibile_sito: fd.get("visibile_sito") === "on",
    ricambio_giorni: ricambio_giorni != null && ricambio_giorni > 0 ? Math.round(ricambio_giorni) : null,
    modello_id: tipo === "lac" ? str(fd, "modello_id") : null,
    parametri: parametri as Json,
  };
}

export async function creaProdotto(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const dati = prodottoDaForm(formData);
  if (!dati.nome) return { errore: "Il nome del prodotto è obbligatorio." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { data, error } = await supabase
    .from("prodotti")
    .insert({ ...dati, azienda_id: prof.azienda_id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { errore: "SKU già in uso su un altro prodotto." };
    return { errore: `Creazione non riuscita: ${error.message}` };
  }

  revalidatePath("/magazzino");
  redirect(`/magazzino/prodotti/${data.id}`);
}

export async function aggiornaProdotto(
  id: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const dati = prodottoDaForm(formData);
  if (!dati.nome) return { errore: "Il nome del prodotto è obbligatorio." };
  const attivo = formData.get("attivo") === "on";

  const { error } = await supabase
    .from("prodotti")
    .update({ ...dati, attivo })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { errore: "SKU già in uso su un altro prodotto." };
    return { errore: `Salvataggio non riuscito: ${error.message}` };
  }

  revalidatePath("/magazzino");
  revalidatePath(`/magazzino/prodotti/${id}`);
  redirect(`/magazzino/prodotti/${id}`);
}

/* ── Magazzino: movimenti (la giacenza la muove il trigger) ─────────── */

type TipoMovimento = MovimentoMagazzinoRow["tipo"];

const MOVIMENTI_MANUALI = ["scarico", "reso_fornitore", "danno", "uso_interno"] as const;

/** Disponibile = giacenza − Σ fermi attivi (§2.6). */
async function disponibileProdotto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prodottoId: string
): Promise<number> {
  const [{ data: prod }, { data: fermi }] = await Promise.all([
    supabase.from("prodotti").select("giacenza").eq("id", prodottoId).maybeSingle(),
    supabase
      .from("fermi")
      .select("quantita")
      .eq("prodotto_id", prodottoId)
      .eq("stato", "attivo"),
  ]);
  const giacenza = prod?.giacenza ?? 0;
  const impegnata = (fermi ?? []).reduce((s, f) => s + f.quantita, 0);
  return giacenza - impegnata;
}

export async function caricoDaBolla(
  prodottoId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const bolla = str(formData, "bolla");
  const qBolla = Math.round(num(formData, "qta_bolla") ?? 0);
  const qContataRaw = num(formData, "qta_contata");
  const qContata = qContataRaw === null ? qBolla : Math.round(qContataRaw);

  if (qBolla < 1) return { errore: "La quantità in bolla dev'essere almeno 1." };
  if (qContata < 0) return { errore: "La quantità contata non può essere negativa." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;
  const { data: prodotto, error: prodottoErrore } = await supabase
    .from("prodotti")
    .select("costo, prezzo")
    .eq("id", prodottoId)
    .maybeSingle();
  if (prodottoErrore || !prodotto) return { errore: "Prodotto non trovato." };

  // 1) carico = quantità IN BOLLA (riferimento = n° bolla)
  const { error: e1 } = await supabase.from("movimenti_magazzino").insert({
    azienda_id: prof.azienda_id,
    prodotto_id: prodottoId,
    utente_id: prof.id,
    tipo: "carico",
    quantita: qBolla,
    riferimento: bolla ? `Bolla ${bolla}` : "Carico",
    valore_costo: prodotto.costo,
    valore_prezzo: prodotto.prezzo,
  });
  if (e1) return { errore: `Carico non riuscito: ${e1.message}` };

  // 2) rettifica se il contato differisce dalla bolla
  const diff = qContata - qBolla;
  if (diff !== 0) {
    const { error: e2 } = await supabase.from("movimenti_magazzino").insert({
      azienda_id: prof.azienda_id,
      prodotto_id: prodottoId,
      utente_id: prof.id,
      tipo: "rettifica",
      quantita: diff,
      note: `Differenza da bolla ${bolla ?? "—"}`,
      valore_costo: prodotto.costo,
      valore_prezzo: prodotto.prezzo,
    });
    if (e2) return { errore: `Rettifica non riuscita: ${e2.message}` };
  }

  revalidatePath("/magazzino");
  revalidatePath(`/magazzino/prodotti/${prodottoId}`);
  return null;
}

export async function registraMovimento(
  prodottoId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  try {
    const supabase = await createClient();
    const tipo = str(formData, "tipo");
    const q = Math.round(num(formData, "quantita") ?? 0);
    if (q < 1) return { errore: "La quantità dev'essere almeno 1." };

    let quantita: number;
    let note: string | null;
    let riferimento: string | null = str(formData, "riferimento");
    let tipoFinale: TipoMovimento;
    let causaleCodice: string | null = str(formData, "causale_codice");

    if (tipo === "rettifica") {
      await richiedi("rettifiche_inventario");
      const motivo = str(formData, "motivo");
      if (!motivo) return { errore: "La rettifica richiede un motivo." };
      quantita = str(formData, "direzione") === "-" ? -q : q;
      note = motivo;
      riferimento = null;
      tipoFinale = "rettifica";
    } else if ((MOVIMENTI_MANUALI as readonly string[]).includes(tipo ?? "")) {
      await richiedi("scarichi_con_causale");
      if (!causaleCodice) return { errore: "Lo scarico richiede una causale." };
      quantita = -q;
      note = str(formData, "motivo");
      tipoFinale = tipo as TipoMovimento;
      if (tipoFinale === "reso_fornitore") causaleCodice = "reso_fornitore";
    } else {
      return { errore: "Tipo di movimento non ammesso." };
    }

    const prof = await profiloCorrente(supabase);
    if ("errore" in prof) return prof;
    const { data: prodotto, error: prodottoErrore } = await supabase
      .from("prodotti")
      .select("costo, prezzo")
      .eq("id", prodottoId)
      .maybeSingle();
    if (prodottoErrore || !prodotto) return { errore: "Prodotto non trovato." };

    const costoDaForm = num(formData, "valore_costo");
    const prezzoDaForm = num(formData, "valore_prezzo");
    const valoreCosto = costoDaForm ?? prodotto.costo;
    const valorePrezzo = prezzoDaForm ?? prodotto.prezzo;

    const { error } = await supabase.from("movimenti_magazzino").insert({
      azienda_id: prof.azienda_id,
      prodotto_id: prodottoId,
      utente_id: prof.id,
      tipo: tipoFinale,
      quantita,
      riferimento,
      note,
      causale_codice: causaleCodice,
      valore_costo: valoreCosto,
      valore_prezzo: valorePrezzo,
    });
    if (error) return { errore: `Movimento non riuscito: ${error.message}` };

    revalidatePath("/magazzino");
    revalidatePath(`/magazzino/prodotti/${prodottoId}`);
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/* ── B3 · Catalogo, ricevimento e difetti ─────────────────────────── */

const DURATE_LAC = [
  "giornaliera", "quindicinale", "mensile", "trimestrale", "semestrale", "annuale", "convenzionale",
] as const;
const TIPOLOGIE_LAC = ["monofocale", "multifocale", "rigida", "semirigida", "specialistica"] as const;

/** Codifica-famiglia riusabile dal futuro ordine B4 (M5 §4). */
export async function creaModelloLac(_prev: Esito, formData: FormData): Promise<Esito> {
  try {
    const autorizzato = await richiedi("carico_bolle");
    const fornitore = str(formData, "fornitore");
    const nome = str(formData, "nome");
    const tipologia = str(formData, "tipologia");
    const durata = str(formData, "durata");
    if (!fornitore || !nome) return { errore: "Fornitore e nome del modello sono obbligatori." };
    if (!(TIPOLOGIE_LAC as readonly string[]).includes(tipologia ?? "")) return { errore: "Tipologia LAC non ammessa." };
    if (!(DURATE_LAC as readonly string[]).includes(durata ?? "")) return { errore: "Durata LAC non ammessa." };

    const testoProducibilita = str(formData, "producibilita");
    const testoUpc = str(formData, "upc_mappa");
    const producibilita = jsonDaForm(formData, "producibilita");
    const upcMappa = jsonDaForm(formData, "upc_mappa");
    if (testoProducibilita && !producibilita) return { errore: "Lo schema di producibilità non è JSON valido." };
    if (testoUpc && !upcMappa) return { errore: "La mappa UPC non è JSON valida." };

    const supabase = await createClient();
    const { error } = await supabase.from("lac_modelli").insert({
      azienda_id: autorizzato.azienda_id,
      fornitore,
      nome,
      tipologia: tipologia as (typeof TIPOLOGIE_LAC)[number],
      durata: durata as (typeof DURATE_LAC)[number],
      sottotipo: str(formData, "sottotipo") as "sclerale" | "ortocheratologia" | "cheratocono" | "ibrida" | "altro" | null,
      geometria: str(formData, "geometria") as "sferica" | "torica" | null,
      pezzi_per_confezione: Math.max(1, Math.round(num(formData, "pezzi_per_confezione") ?? 1)),
      bc_disponibili: numeriCsv(formData, "bc_disponibili"),
      dia_disponibili: numeriCsv(formData, "dia_disponibili"),
      producibilita: producibilita ?? {},
      upc_mappa: upcMappa ?? {},
      campioni: formData.get("campioni") === "on",
    });
    if (error?.code === "23505") return { errore: "Esiste già una famiglia LAC con fornitore e nome uguali." };
    if (error) return { errore: `Modello LAC non creato: ${error.message}` };
    revalidatePath("/magazzino");
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Ricevimento M3: la RPC scrive insieme movimento reale, riga e stato bolla. */
export async function riceviRigaBolla(
  rigaId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  try {
    const autorizzato = await richiedi("carico_bolle");
    const quantita = Math.round(num(formData, "quantita") ?? 0);
    if (quantita < 1) return { errore: "La quantità ricevuta dev'essere almeno 1." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("ricevi_riga_bolla", {
      p_riga_id: rigaId,
      p_quantita: quantita,
      p_utente_id: autorizzato.utente_id,
    });
    if (error) return { errore: `Ricevimento non riuscito: ${error.message}` };
    revalidatePath("/magazzino");
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Chiude una differenza spiegata senza inventare movimenti o giacenza. */
export async function chiudiBollaAttesa(
  bollaId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  try {
    await richiedi("modifica_bolle");
    const nota = str(formData, "chiusura_nota");
    if (!nota) return { errore: "La chiusura della differenza richiede un motivo." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("bolle_attese")
      .update({ chiusa_il: new Date().toISOString(), chiusura_nota: nota })
      .eq("id", bollaId)
      .neq("stato", "annullata");
    if (error) return { errore: `Bolla non chiusa: ${error.message}` };
    revalidatePath("/magazzino");
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Registro difetto di conformità: le foto restano reference, mai blob in DB. */
export async function creaPraticaDifetto(_prev: Esito, formData: FormData): Promise<Esito> {
  try {
    const autorizzato = await richiedi("resi");
    const fornitore = str(formData, "fornitore");
    const descrizione = str(formData, "descrizione");
    const proprieta = str(formData, "proprieta");
    if (!fornitore || !descrizione) return { errore: "Fornitore e descrizione sono obbligatori." };
    if (proprieta !== "cliente" && proprieta !== "esposizione") return { errore: "Proprietà della pratica non valida." };
    const fotoRefs = (str(formData, "foto_refs") ?? "")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    const supabase = await createClient();
    const { error } = await supabase.from("pratiche_difetto").insert({
      azienda_id: autorizzato.azienda_id,
      prodotto_id: str(formData, "prodotto_id"),
      cliente_id: str(formData, "cliente_id"),
      origine_busta_id: str(formData, "origine_busta_id"),
      fornitore,
      upc: str(formData, "upc"),
      riferimento_busta: str(formData, "riferimento_busta"),
      proprieta,
      descrizione,
      foto_refs: fotoRefs,
      accordi_note: str(formData, "accordi_note"),
    });
    if (error) return { errore: `Pratica difetto non creata: ${error.message}` };
    revalidatePath("/magazzino");
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Binario M3: aperta → riconosciuta/respinta → chiusa. */
export async function avanzaPraticaDifetto(
  praticaId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  try {
    await richiedi("resi");
    const statoRichiesto = str(formData, "stato");
    const esito = str(formData, "esito");
    const supabase = await createClient();
    const { data: pratica } = await supabase
      .from("pratiche_difetto")
      .select("stato, esito")
      .eq("id", praticaId)
      .maybeSingle();
    if (!pratica) return { errore: "Pratica difetto non trovata." };

    const transizioneValida =
      (pratica.stato === "aperta" && (statoRichiesto === "riconosciuta" || statoRichiesto === "respinta")) ||
      ((pratica.stato === "riconosciuta" || pratica.stato === "respinta") && statoRichiesto === "chiusa");
    if (!transizioneValida) return { errore: "Transizione della pratica non ammessa." };
    if (statoRichiesto === "respinta" && esito && esito !== "respinto") return { errore: "Una pratica respinta ha esito respinto." };
    if (statoRichiesto === "riconosciuta" && esito && !["sostituzione", "rimborso"].includes(esito)) {
      return { errore: "L'esito riconosciuto è sostituzione o rimborso." };
    }

    const { error } = await supabase
      .from("pratiche_difetto")
      .update({
        stato: statoRichiesto as "riconosciuta" | "respinta" | "chiusa",
        esito: (statoRichiesto === "respinta" ? "respinto" : esito ?? pratica.esito) as
          | "sostituzione"
          | "rimborso"
          | "respinto"
          | null,
        chiusa_il: statoRichiesto === "chiusa" ? new Date().toISOString() : null,
      })
      .eq("id", praticaId);
    if (error) return { errore: `Pratica difetto non aggiornata: ${error.message}` };
    revalidatePath("/magazzino");
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/* ── Magazzino: fermi ──────────────────────────────────────────────── */

export async function creaFermo(
  prodottoId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const clienteId = str(formData, "cliente_id");
  if (!clienteId) return { errore: "Seleziona un cliente per il fermo." };
  const q = Math.round(num(formData, "quantita") ?? 0);
  if (q < 1) return { errore: "La quantità dev'essere almeno 1." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const disp = await disponibileProdotto(supabase, prodottoId);
  if (q > disp) return { errore: `Disponibili solo ${disp} pezzi da fermare.` };

  const { error } = await supabase.from("fermi").insert({
    azienda_id: prof.azienda_id,
    prodotto_id: prodottoId,
    cliente_id: clienteId,
    utente_id: prof.id,
    quantita: q,
    stato: "attivo",
    scade_il: str(formData, "scade_il"),
    note: str(formData, "note"),
  });
  if (error) return { errore: `Fermo non riuscito: ${error.message}` };

  revalidatePath("/magazzino");
  revalidatePath(`/magazzino/prodotti/${prodottoId}`);
  revalidatePath(`/clienti/${clienteId}`);
  return null;
}

export async function eventoFermo(
  id: string,
  evento: "ritira" | "annulla",
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  void formData;

  const { data: fermo } = await supabase
    .from("fermi")
    .select("stato, prodotto_id, cliente_id, quantita, azienda_id")
    .eq("id", id)
    .maybeSingle();
  if (!fermo) return { errore: "Fermo non trovato." };
  if (fermo.stato !== "attivo") return { errore: `Fermo già ${fermo.stato}.` };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  if (evento === "ritira") {
    const { data: cli } = await supabase
      .from("clienti")
      .select("nome, cognome")
      .eq("id", fermo.cliente_id)
      .maybeSingle();
    const rif = cli ? `Fermo ${cli.cognome} ${cli.nome}` : "Fermo ritirato";
    const { error: em } = await supabase.from("movimenti_magazzino").insert({
      azienda_id: fermo.azienda_id,
      prodotto_id: fermo.prodotto_id,
      utente_id: prof.id,
      tipo: "scarico",
      quantita: -fermo.quantita,
      riferimento: rif,
    });
    if (em) return { errore: `Scarico non riuscito: ${em.message}` };
    const { error } = await supabase.from("fermi").update({ stato: "ritirato" }).eq("id", id);
    if (error) return { errore: `Aggiornamento non riuscito: ${error.message}` };
  } else {
    const { error } = await supabase.from("fermi").update({ stato: "annullato" }).eq("id", id);
    if (error) return { errore: `Aggiornamento non riuscito: ${error.message}` };
  }

  revalidatePath("/magazzino");
  revalidatePath(`/magazzino/prodotti/${fermo.prodotto_id}`);
  revalidatePath(`/clienti/${fermo.cliente_id}`);
  return null;
}

/* ── Agenda ────────────────────────────────────────────────────────── */

const TIPI_APPUNTAMENTO = [
  "controllo_vista",
  "consegna",
  "ritiro_lac",
  "prima_applicazione_lac",
  "altro",
] as const;

export async function creaAppuntamento(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();

  const data = str(formData, "data");
  const ora = str(formData, "ora");
  if (!data || !ora) return { errore: "Servono data e ora." };
  // L'ora scelta è di PARETE italiana: la si ancora a Europe/Rome, non al fuso
  // del processo (UTC su Vercel), o «10:00» diventa un istante diverso da quello
  // che scrive il portale per le stesse 10:00. Vedi lib/utils § fuso / TODO §6.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}/.test(ora)) {
    return { errore: "Data o ora non valide." };
  }
  const inizioISO = istanteRomaISO(data, ora);

  const durata = Math.round(num(formData, "durata_minuti") ?? 20);
  if (durata < 5 || durata > 240) return { errore: "La durata dev'essere tra 5 e 240 minuti." };

  const tipoRaw = str(formData, "tipo") ?? "controllo_vista";
  const tipo = (TIPI_APPUNTAMENTO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_APPUNTAMENTO)[number])
    : "controllo_vista";

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase.from("appuntamenti").insert({
    azienda_id: prof.azienda_id,
    cliente_id: str(formData, "cliente_id"),
    utente_id: str(formData, "utente_id") ?? prof.id,
    tipo,
    inizio: inizioISO,
    durata_minuti: durata,
    stato: "prenotato",
    riferimento: str(formData, "riferimento"),
    note: str(formData, "note"),
  });
  if (error) return { errore: `Appuntamento non salvato: ${error.message}` };

  revalidatePath("/agenda");
  redirect(`/agenda?data=${data}`);
}

export async function eventoAppuntamento(
  id: string,
  evento: "completa" | "mancato" | "annulla",
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("appuntamenti")
    .select("stato, note, inizio")
    .eq("id", id)
    .maybeSingle();
  if (!app) return { errore: "Appuntamento non trovato." };
  if (app.stato !== "prenotato") return { errore: `Nessuna azione: appuntamento ${app.stato}.` };

  const nuovoStato =
    evento === "completa" ? "completato" : evento === "mancato" ? "mancato" : "annullato";
  const patch: { stato: "completato" | "mancato" | "annullato"; note?: string | null } = {
    stato: nuovoStato,
  };
  if (evento === "annulla") {
    const motivo = str(formData, "motivo");
    if (motivo) patch.note = appendiNota(app.note, `— Annullato ${dataIt()}: ${motivo}`);
  }

  const { error } = await supabase.from("appuntamenti").update(patch).eq("id", id);
  if (error) return { errore: `Operazione non riuscita: ${error.message}` };

  revalidatePath("/agenda");
  return null;
}

/* ── Agenda · G8 · le richieste dal portale dentro l'agenda ──────────── */
// Transizioni NUOVE, con guardie di stato PROPRIE: non si tocca
// `eventoAppuntamento` (§7). Ogni azione verifica lo stato di partenza e
// l'update è condizionato (`.eq("stato","in_attesa")`) così due tocchi non
// producono due effetti. Tutto dentro il tenant via RLS: niente service role.

/** Accetta una richiesta: appuntamento in_attesa→prenotato, prenotazione→accettata. */
export async function accettaRichiesta(id: string, _prev: Esito, _formData: FormData): Promise<Esito> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("appuntamenti")
    .select("stato")
    .eq("id", id)
    .maybeSingle();
  if (!app) return { errore: "Appuntamento non trovato." };
  if (app.stato !== "in_attesa") return { errore: `Nessuna azione: la richiesta è ${app.stato}.` };

  const { data: upd, error: e1 } = await supabase
    .from("appuntamenti")
    .update({ stato: "prenotato" })
    .eq("id", id)
    .eq("stato", "in_attesa")
    .select("id");
  if (e1) return { errore: `Operazione non riuscita: ${e1.message}` };
  if (!upd || upd.length === 0) return { errore: "La richiesta è già stata gestita." };

  const { error: e2 } = await supabase
    .from("prenotazioni")
    .update({ stato: "accettata" })
    .eq("appuntamento_id", id)
    .eq("stato", "in_attesa");
  if (e2) return { errore: `Prenotazione non aggiornata: ${e2.message}` };

  revalidatePath("/agenda");
  return null;
}

/** Rifiuta una richiesta: appuntamento in_attesa→annullato (motivo facoltativo in
 *  nota), prenotazione→rifiutata. Lo slot torna libero da sé: l'EXCLUDE non conta
 *  gli annullati (§5). */
export async function rifiutaRichiesta(id: string, _prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("appuntamenti")
    .select("stato, note")
    .eq("id", id)
    .maybeSingle();
  if (!app) return { errore: "Appuntamento non trovato." };
  if (app.stato !== "in_attesa") return { errore: `Nessuna azione: la richiesta è ${app.stato}.` };

  const motivo = str(formData, "motivo");
  const patch: { stato: "annullato"; note?: string | null } = { stato: "annullato" };
  if (motivo) patch.note = appendiNota(app.note, `— Rifiutata ${dataIt()}: ${motivo}`);

  const { data: upd, error: e1 } = await supabase
    .from("appuntamenti")
    .update(patch)
    .eq("id", id)
    .eq("stato", "in_attesa")
    .select("id");
  if (e1) return { errore: `Operazione non riuscita: ${e1.message}` };
  if (!upd || upd.length === 0) return { errore: "La richiesta è già stata gestita." };

  const { error: e2 } = await supabase
    .from("prenotazioni")
    .update({ stato: "rifiutata" })
    .eq("appuntamento_id", id)
    .eq("stato", "in_attesa");
  if (e2) return { errore: `Prenotazione non aggiornata: ${e2.message}` };

  revalidatePath("/agenda");
  return null;
}

/** Esegue la presa come cliente via la funzione security definer (unico percorso
 *  di scrittura verso persone/registro, ID-01). Mappa gli errori del DB. */
async function eseguiPrendiCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prenotazioneId: string,
  clienteId: string | null
): Promise<{ ok: true; clienteId: string } | { errore: string }> {
  const { data, error } = await supabase.rpc("prendi_persona_come_cliente", {
    p_prenotazione_id: prenotazioneId,
    p_cliente_id: clienteId,
  });
  if (error) {
    const m = error.message;
    if (m.includes("NON_ACCETTATA")) return { errore: "Serve prima accettare la richiesta." };
    if (m.includes("CLIENTE_NON_TUO")) return { errore: "Quel cliente non è del tuo negozio." };
    if (m.includes("NON_TUA")) return { errore: "Questa richiesta non è del tuo negozio." };
    if (m.includes("PRENOTAZIONE_NON_TROVATA")) return { errore: "Richiesta non trovata." };
    // C1 voce 6: l'anonimizzazione ha sganciato la persona da questa richiesta.
    if (m.includes("PRENOTAZIONE_SGANCIATA"))
      return {
        errore:
          "I dati di chi aveva prenotato sono stati eliminati: non c'è più nessuno da prendere come cliente.",
      };
    return { errore: `Operazione non riuscita: ${m}` };
  }
  revalidatePath("/agenda");
  return { ok: true, clienteId: data as string };
}

/**
 * «Prendi come cliente» (§6) — atto SEPARATO, volontario. Chiamabile direttamente
 * dal client (non form-bound).
 *  · "auto"  → cerca un cliente proprio con lo stesso telefono. Se c'è, PROPONE di
 *    collegarlo (non scrive); altrimenti crea subito.
 *  · "nuovo" → crea comunque un nuovo cliente.
 *  · {collega} → collega il cliente esistente scelto.
 * Nessun consenso commerciale: quello si raccoglie con la procedura della 4d.
 */
export async function prendiComeCliente(
  prenotazioneId: string,
  scelta: "auto" | "nuovo" | { collega: string }
): Promise<
  | { ok: true; clienteId: string }
  | { proposta: { id: string; nome: string; cognome: string } }
  | { errore: string }
> {
  const supabase = await createClient();

  const { data: pren } = await supabase
    .from("prenotazioni")
    .select("stato, cliente_id, contatto_telefono")
    .eq("id", prenotazioneId)
    .maybeSingle();
  if (!pren) return { errore: "Richiesta non trovata." };
  if (pren.stato !== "accettata") return { errore: "Serve prima accettare la richiesta." };
  if (pren.cliente_id) return { ok: true, clienteId: pren.cliente_id }; // già presa (idempotente)

  if (scelta === "auto") {
    const { data: esist, error } = await supabase.rpc("cliente_per_telefono", {
      p_telefono: pren.contatto_telefono,
    });
    if (error) return { errore: `Ricerca non riuscita: ${error.message}` };
    const match = (Array.isArray(esist) ? esist[0] : esist) as
      | { id: string; nome: string; cognome: string }
      | undefined;
    if (match) return { proposta: { id: match.id, nome: match.nome, cognome: match.cognome } };
    return eseguiPrendiCliente(supabase, prenotazioneId, null);
  }
  if (scelta === "nuovo") return eseguiPrendiCliente(supabase, prenotazioneId, null);
  return eseguiPrendiCliente(supabase, prenotazioneId, scelta.collega);
}

/* ── Richiami ──────────────────────────────────────────────────────── */

const TIPI_RICHIAMO = [
  "controllo_vista",
  "lac_esaurimento",
  "ritiro_sollecito",
  "fermo_scadenza",
  "promessa_ritardo",
  "generico",
] as const;
const CANALI = ["telefono", "whatsapp", "sms", "email", "di_persona"] as const;
const ESITI = ["appuntamento_fissato", "richiamare", "non_risponde", "non_interessato", "gestito"] as const;

function tipoAppuntamentoDaRichiamo(tipoRichiamo: string, riferimento: string | null): string {
  if (tipoRichiamo === "controllo_vista") return "controllo_vista";
  const rif = (riferimento ?? "").toUpperCase();
  if (rif.startsWith("BL")) return "consegna";
  if (rif.startsWith("OL")) return "ritiro_lac";
  return "altro";
}

function urlAgendaPrefill(clienteId: string, tipoRichiamo: string, riferimento: string | null): string {
  const p = new URLSearchParams();
  p.set("cliente", clienteId);
  p.set("tipo", tipoAppuntamentoDaRichiamo(tipoRichiamo, riferimento));
  if (riferimento) p.set("riferimento", riferimento);
  return `/agenda/nuovo?${p.toString()}`;
}

export async function creaRichiamo(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const clienteId = str(formData, "cliente_id");
  if (!clienteId) return { errore: "Seleziona un cliente." };

  const tipoRaw = str(formData, "tipo") ?? "generico";
  const tipo = (TIPI_RICHIAMO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_RICHIAMO)[number])
    : "generico";

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase.from("richiami").insert({
    azienda_id: prof.azienda_id,
    cliente_id: clienteId,
    tipo,
    da_fare_il: str(formData, "da_fare_il") ?? new Date().toISOString().slice(0, 10),
    riferimento: str(formData, "riferimento"),
    valore: num(formData, "valore"),
    note: str(formData, "note"),
  });
  if (error) return { errore: `Richiamo non salvato: ${error.message}` };

  revalidatePath("/richiami");
  redirect("/richiami");
}

/** Valida e compone canale/esito/valore/note comuni ai due flussi di esito. */
function leggiEsito(formData: FormData):
  | { errore: string }
  | { canale: (typeof CANALI)[number]; esito: (typeof ESITI)[number]; valore: number | null; note: string | null } {
  const canale = str(formData, "canale");
  const esito = str(formData, "esito");
  if (!canale || !(CANALI as readonly string[]).includes(canale)) return { errore: "Scegli il canale del contatto." };
  if (!esito || !(ESITI as readonly string[]).includes(esito)) return { errore: "Scegli l'esito." };
  return {
    canale: canale as (typeof CANALI)[number],
    esito: esito as (typeof ESITI)[number],
    valore: num(formData, "valore"),
    note: str(formData, "note"),
  };
}

export async function registraEsitoRichiamo(
  id: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("richiami")
    .select("esito, cliente_id, tipo, riferimento")
    .eq("id", id)
    .maybeSingle();
  if (!r) return { errore: "Richiamo non trovato." };
  if (r.esito) return { errore: "Questo richiamo è già stato lavorato." };

  const e = leggiEsito(formData);
  if ("errore" in e) return e;

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase
    .from("richiami")
    .update({
      canale: e.canale,
      esito: e.esito,
      fatto_il: new Date().toISOString(),
      utente_id: prof.id,
      valore: e.valore,
      note: e.note,
    })
    .eq("id", id);
  if (error) return { errore: `Esito non salvato: ${error.message}` };

  revalidatePath("/richiami");
  if (e.esito === "appuntamento_fissato" && r.cliente_id) {
    redirect(urlAgendaPrefill(r.cliente_id, r.tipo, r.riferimento));
  }
  return null;
}

export async function registraEsitoProposta(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();

  const clienteId = str(formData, "cliente_id");
  if (!clienteId) return { errore: "Cliente mancante." };
  const tipoRaw = str(formData, "tipo") ?? "generico";
  const tipo = (TIPI_RICHIAMO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_RICHIAMO)[number])
    : "generico";
  const riferimento = str(formData, "riferimento");

  const e = leggiEsito(formData);
  if ("errore" in e) return e;

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase.from("richiami").insert({
    azienda_id: prof.azienda_id,
    cliente_id: clienteId,
    tipo,
    da_fare_il: new Date().toISOString().slice(0, 10),
    canale: e.canale,
    esito: e.esito,
    fatto_il: new Date().toISOString(),
    utente_id: prof.id,
    riferimento,
    valore: e.valore,
    note: e.note,
  });
  if (error) return { errore: `Esito non salvato: ${error.message}` };

  revalidatePath("/richiami");
  if (e.esito === "appuntamento_fissato") {
    redirect(urlAgendaPrefill(clienteId, tipo, riferimento));
  }
  return null;
}

/* ── Cassa: helper ─────────────────────────────────────────────────── */

const ALIQUOTE = ["4", "22", "esente"] as const;

function parseRigheVendita(fd: FormData): RigaVendita[] | { errore: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "righe") ?? "[]");
  } catch {
    return { errore: "Righe non valide." };
  }
  if (!Array.isArray(raw) || raw.length === 0) return { errore: "Aggiungi almeno una riga." };
  const righe: RigaVendita[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const descrizione = typeof r.descrizione === "string" ? r.descrizione.trim() : "";
    if (!descrizione) return { errore: "Ogni riga deve avere una descrizione." };
    const quantita = Math.round(Number(r.quantita));
    if (!Number.isFinite(quantita) || quantita < 1) return { errore: "Quantità non valida." };
    const prezzo_unitario = Number(r.prezzo_unitario);
    if (!Number.isFinite(prezzo_unitario) || prezzo_unitario < 0) return { errore: "Prezzo non valido." };
    let sconto = Number(r.sconto);
    if (!Number.isFinite(sconto) || sconto < 0) sconto = 0;
    const aliquota = (ALIQUOTE as readonly string[]).includes(String(r.aliquota))
      ? (String(r.aliquota) as "4" | "22" | "esente")
      : "22";
    righe.push({
      prodotto_id: typeof r.prodotto_id === "string" ? r.prodotto_id : null,
      descrizione,
      quantita,
      prezzo_unitario: euro2(prezzo_unitario),
      sconto: euro2(sconto),
      aliquota,
      dm: !!r.dm,
    });
  }
  return righe;
}

function parsePagamenti(fd: FormData): PagamentoVendita[] {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "pagamenti") ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const pag: PagamentoVendita[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const importo = Number(p.importo);
    if (!Number.isFinite(importo) || importo <= 0) continue;
    pag.push({
      metodo_id: typeof p.metodo_id === "string" ? p.metodo_id : null,
      nome: typeof p.nome === "string" ? p.nome : "Pagamento",
      importo: euro2(importo),
    });
  }
  return pag;
}

function totaleEIva(righe: RigaVendita[]): { totale: number; iva: number } {
  let totale = 0;
  let iva = 0;
  for (const r of righe) {
    const imp = Math.max(0, r.quantita * r.prezzo_unitario - r.sconto);
    totale += imp;
    iva += ivaScorporo(imp, r.aliquota);
  }
  return { totale: euro2(totale), iva: euro2(iva) };
}

/** Movimenti di magazzino per le righe con prodotto_id (scarico/carico). */
async function movimentiDaRighe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aziendaId: string,
  utenteId: string,
  righe: RigaVendita[],
  verso: "scarico" | "carico",
  riferimento: string
) {
  for (const r of righe) {
    if (!r.prodotto_id) continue;
    const q = Math.round(r.quantita);
    if (q < 1) continue;
    await supabase.from("movimenti_magazzino").insert({
      azienda_id: aziendaId,
      prodotto_id: r.prodotto_id,
      utente_id: utenteId,
      tipo: verso,
      quantita: verso === "scarico" ? -q : q,
      riferimento,
    });
  }
}

/* ── Cassa: metodi di pagamento ────────────────────────────────────── */

const METODI_BASE: { nome: string; tipo: string; tracciabile: boolean; ordine: number }[] = [
  { nome: "Contanti", tipo: "contanti", tracciabile: false, ordine: 1 },
  { nome: "Bancomat", tipo: "elettronico", tracciabile: true, ordine: 2 },
  { nome: "Mastercard", tipo: "elettronico", tracciabile: true, ordine: 3 },
  { nome: "Visa", tipo: "elettronico", tracciabile: true, ordine: 4 },
  { nome: "Bonifico", tipo: "bonifico", tracciabile: true, ordine: 5 },
  { nome: "Gift Card", tipo: "buono", tracciabile: true, ordine: 6 },
  { nome: "Assicurazione", tipo: "assicurazione", tracciabile: true, ordine: 7 },
  { nome: "Caparra", tipo: "caparra", tracciabile: true, ordine: 8 },
];

async function assicuraMetodi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  aziendaId: string
) {
  const { data: esistenti } = await supabase.from("metodi_pagamento").select("nome");
  const nomi = new Set((esistenti ?? []).map((m) => m.nome));
  const daInserire = METODI_BASE.filter((m) => !nomi.has(m.nome)).map((m) => ({
    ...m,
    tipo: m.tipo as "contanti" | "elettronico" | "buono" | "bonifico" | "assicurazione" | "caparra" | "altro",
    azienda_id: aziendaId,
  }));
  if (daInserire.length) await supabase.from("metodi_pagamento").insert(daInserire);
}

export async function seedMetodiPagamento(_prev: Esito, _formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;
  await assicuraMetodi(supabase, prof.azienda_id);
  revalidatePath("/cassa/impostazioni");
  return null;
}

const TIPI_METODO = ["contanti", "elettronico", "buono", "bonifico", "assicurazione", "caparra", "altro"] as const;

export async function creaMetodoPagamento(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const nome = str(formData, "nome");
  if (!nome) return { errore: "Serve il nome del metodo." };
  const tipoRaw = str(formData, "tipo") ?? "altro";
  const tipo = (TIPI_METODO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_METODO)[number])
    : "altro";
  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;
  const { error } = await supabase.from("metodi_pagamento").insert({
    azienda_id: prof.azienda_id,
    nome,
    tipo,
    tracciabile: formData.get("tracciabile") === "on",
    ordine: Math.round(num(formData, "ordine") ?? 0),
  });
  if (error) {
    if (error.code === "23505") return { errore: "Esiste già un metodo con questo nome." };
    return { errore: `Non salvato: ${error.message}` };
  }
  revalidatePath("/cassa/impostazioni");
  return null;
}

export async function aggiornaMetodoPagamento(
  id: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const { data: m } = await supabase.from("metodi_pagamento").select("tipo").eq("id", id).maybeSingle();
  if (!m) return { errore: "Metodo non trovato." };
  const attivo = m.tipo === "caparra" ? true : formData.get("attivo") === "on";
  const { error } = await supabase
    .from("metodi_pagamento")
    .update({ attivo, tracciabile: formData.get("tracciabile") === "on", ordine: Math.round(num(formData, "ordine") ?? 0) })
    .eq("id", id);
  if (error) return { errore: `Non salvato: ${error.message}` };
  revalidatePath("/cassa/impostazioni");
  return null;
}

/* ── Cassa: vendite ────────────────────────────────────────────────── */

export async function creaVendita(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const righe = parseRigheVendita(formData);
  if ("errore" in righe) return righe;
  const pagamenti = parsePagamenti(formData);
  const { totale, iva } = totaleEIva(righe);
  const sommaPag = euro2(pagamenti.reduce((s, p) => s + p.importo, 0));
  if (Math.abs(sommaPag - totale) > 0.01) {
    return { errore: `I pagamenti (${sommaPag.toFixed(2)}) non coprono il totale (${totale.toFixed(2)}).` };
  }

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const riallineamento = formData.get("riallineamento") === "on";
  const docNumero = str(formData, "doc_numero");
  const docData = str(formData, "doc_data");
  let dataVendita = new Date().toISOString();
  if (riallineamento) {
    if (!docNumero || !docData) return { errore: "Il riallineamento richiede numero e data del documento." };
    const dv = str(formData, "data_vendita");
    if (dv) dataVendita = new Date(`${dv}T12:00:00`).toISOString();
  }

  const { data: numero, error: eN } = await supabase.rpc("prossimo_numero", { p_prefisso: "VE" });
  if (eN || !numero) return { errore: `Numerazione non riuscita: ${eN?.message ?? "riprova"}` };

  const { data: vend, error } = await supabase
    .from("vendite")
    .insert({
      azienda_id: prof.azienda_id,
      cliente_id: str(formData, "cliente_id"),
      utente_id: prof.id,
      numero,
      righe: righe as unknown as Json,
      pagamenti: pagamenti as unknown as Json,
      totale,
      iva_totale: iva,
      doc_numero: docNumero,
      doc_data: docData,
      fattura_numero: str(formData, "fattura_numero"),
      cf_cliente: str(formData, "cf_cliente")?.toUpperCase() ?? null,
      opposizione_ts: formData.get("opposizione_ts") === "on",
      origine: riallineamento ? "riallineamento" : "cassa",
      data_vendita: dataVendita,
      stato: "emessa",
      note: str(formData, "note"),
    })
    .select("id")
    .single();
  if (error) return { errore: `Vendita non riuscita: ${error.message}` };

  await movimentiDaRighe(supabase, prof.azienda_id, prof.id, righe, "scarico", numero);

  revalidatePath("/cassa");
  revalidatePath("/magazzino");
  redirect(`/cassa/vendite/${vend.id}`);
}

export async function annullaVendita(id: string, _prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vendite")
    .select("stato, righe, numero, note, azienda_id, data_vendita, busta_id, ordine_lac_id")
    .eq("id", id)
    .maybeSingle();
  if (!v) return { errore: "Vendita non trovata." };
  if (v.stato !== "emessa") return { errore: "La vendita è già annullata." };
  const motivo = str(formData, "motivo");
  if (!motivo) return { errore: "Indica un motivo per l'annullo." };

  // Guardrail temporale (A4): annullo solo su vendite di oggi e a giornata non chiusa;
  // oltre, la strada è il reso.
  const oggi = new Date().toISOString().slice(0, 10);
  const giornoVendita = (v.data_vendita ?? "").slice(0, 10);
  if (giornoVendita && giornoVendita !== oggi) {
    return { errore: "La vendita è di un giorno passato: registra un reso, non un annullo." };
  }
  const { data: chiusuraGiorno } = await supabase
    .from("chiusure_cassa").select("id").eq("data", giornoVendita || oggi).maybeSingle();
  if (chiusuraGiorno) {
    return { errore: "La giornata è già chiusa: per rendere il denaro registra un reso, non un annullo." };
  }

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase
    .from("vendite")
    .update({ stato: "annullata", note: appendiNota(v.note, `— Annullata ${dataIt()}: ${motivo}`) })
    .eq("id", id);
  if (error) return { errore: `Annullo non riuscito: ${error.message}` };

  // Rientro magazzino SOLO per le vendite libere: se la vendita è la consegna di un
  // ordine, la merce è dal cliente → nessun rientro (si passa dal reso con righe).
  const daOrdine = !!(v.busta_id || v.ordine_lac_id);
  if (!daOrdine) {
    const righe = (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[];
    await movimentiDaRighe(supabase, v.azienda_id, prof.id, righe, "carico", `Annullo ${v.numero}`);
  }

  revalidatePath("/cassa");
  revalidatePath(`/cassa/vendite/${id}`);
  revalidatePath("/magazzino");
  return null;
}

/* ── Cassa: resi ───────────────────────────────────────────────────── */

const CAUSALI_RESO = [
  "soddisfatti_rimborsati", "errore_checkup", "errore_ricetta",
  "mancato_adattamento_progressive", "modifica_wo", "insoddisfazione_estetica",
  "insoddisfazione_funzionalita", "difetto_fabbricazione",
] as const;

export async function creaReso(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const venditaId = str(formData, "vendita_id");
  const tipo = str(formData, "tipo") === "gestionale" ? "gestionale" : "denaro";
  const causaleRaw = str(formData, "causale") ?? "";
  if (!(CAUSALI_RESO as readonly string[]).includes(causaleRaw)) return { errore: "Scegli una causale." };
  const importo = num(formData, "importo");
  if (importo === null || importo <= 0) return { errore: "L'importo del reso dev'essere positivo." };
  const metodoRimborso = str(formData, "metodo_rimborso");
  if (tipo === "denaro" && !metodoRimborso) return { errore: "Indica il metodo con cui rimborsi." };

  const docOrigineNum = str(formData, "doc_origine_numero");
  const docOrigineData = str(formData, "doc_origine_data");
  if (!venditaId && (!docOrigineNum || !docOrigineData)) {
    return { errore: "Per un reso di vendita esterna servono numero e data del documento d'origine." };
  }

  let righe: RigaVendita[] = [];
  const rr = parseRigheVendita(formData);
  if (!("errore" in rr)) righe = rr;

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { data: numero, error: eN } = await supabase.rpc("prossimo_numero", { p_prefisso: "RE" });
  if (eN || !numero) return { errore: `Numerazione non riuscita: ${eN?.message ?? "riprova"}` };

  const { data: reso, error } = await supabase
    .from("resi")
    .insert({
      azienda_id: prof.azienda_id,
      vendita_id: venditaId,
      cliente_id: str(formData, "cliente_id"),
      utente_id: prof.id,
      numero,
      tipo,
      causale: causaleRaw as (typeof CAUSALI_RESO)[number],
      importo: euro2(importo),
      metodo_rimborso: tipo === "denaro" ? metodoRimborso : null,
      righe: righe as unknown as Json,
      doc_numero: str(formData, "doc_numero"),
      doc_data: str(formData, "doc_data"),
      doc_origine_numero: docOrigineNum,
      doc_origine_data: docOrigineData,
      note: str(formData, "note"),
    })
    .select("id")
    .single();
  if (error) return { errore: `Reso non riuscito: ${error.message}` };

  await movimentiDaRighe(supabase, prof.azienda_id, prof.id, righe, "carico", numero);

  revalidatePath("/cassa/resi");
  if (venditaId) revalidatePath(`/cassa/vendite/${venditaId}`);
  revalidatePath("/magazzino");
  redirect(`/cassa/resi`);
}

/* ── Cassa: incasso alla consegna ordine (§3.6) ────────────────────── */

export async function incassaConsegna(
  tipoOrdine: "busta" | "lac",
  ordineId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const righe = parseRigheVendita(formData);
  if ("errore" in righe) return righe;
  const pagamenti = parsePagamenti(formData);
  const { totale, iva } = totaleEIva(righe);
  const sommaPag = euro2(pagamenti.reduce((s, p) => s + p.importo, 0));
  if (Math.abs(sommaPag - totale) > 0.01) {
    return { errore: `I pagamenti (${sommaPag.toFixed(2)}) non coprono il totale (${totale.toFixed(2)}).` };
  }

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  // Pre-check: ordine gia' incassato?
  const colonna = tipoOrdine === "busta" ? "busta_id" : "ordine_lac_id";
  const { data: esistente } = await supabase
    .from("vendite")
    .select("id")
    .eq(colonna, ordineId)
    .eq("stato", "emessa")
    .maybeSingle();
  if (esistente) return { errore: "Questo ordine ha già una vendita." };

  // Stato ordine + transizione (guardata)
  if (tipoOrdine === "busta") {
    const { data: b } = await supabase.from("ordini_occhiali").select("stato").eq("id", ordineId).maybeSingle();
    if (!b) return { errore: "Busta non trovata." };
    if (b.stato !== "pronta") return { errore: `La busta non è pronta (stato ${b.stato}).` };
  } else {
    const { data: o } = await supabase.from("ordini_lac").select("stato").eq("id", ordineId).maybeSingle();
    if (!o) return { errore: "Ordine non trovato." };
    if (o.stato !== "arrivato") return { errore: `L'ordine non è arrivato (stato ${o.stato}).` };
  }

  const { data: numero, error: eN } = await supabase.rpc("prossimo_numero", { p_prefisso: "VE" });
  if (eN || !numero) return { errore: `Numerazione non riuscita: ${eN?.message ?? "riprova"}` };

  const { data: vend, error } = await supabase
    .from("vendite")
    .insert({
      azienda_id: prof.azienda_id,
      cliente_id: str(formData, "cliente_id"),
      utente_id: prof.id,
      numero,
      busta_id: tipoOrdine === "busta" ? ordineId : null,
      ordine_lac_id: tipoOrdine === "lac" ? ordineId : null,
      righe: righe as unknown as Json,
      pagamenti: pagamenti as unknown as Json,
      totale,
      iva_totale: iva,
      doc_numero: str(formData, "doc_numero"),
      doc_data: str(formData, "doc_data"),
      fattura_numero: str(formData, "fattura_numero"),
      cf_cliente: str(formData, "cf_cliente")?.toUpperCase() ?? null,
      opposizione_ts: formData.get("opposizione_ts") === "on",
      origine: "cassa",
      stato: "emessa",
      note: str(formData, "note"),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { errore: "Questo ordine ha già una vendita." };
    return { errore: `Vendita non riuscita: ${error.message}` };
  }

  // Transizione ordine → consegnato (guardata sullo stato). Rollback vendita se fallisce.
  const now = new Date().toISOString();
  const trans =
    tipoOrdine === "busta"
      ? await supabase.from("ordini_occhiali").update({ stato: "consegnata", data_consegna: now }).eq("id", ordineId).eq("stato", "pronta").select("id")
      : await supabase.from("ordini_lac").update({ stato: "consegnato", data_consegna: now }).eq("id", ordineId).eq("stato", "arrivato").select("id");
  if (trans.error || !trans.data || trans.data.length === 0) {
    await supabase.from("vendite").update({ stato: "annullata", note: "Rollback: consegna non riuscita" }).eq("id", vend.id);
    return { errore: "Consegna non riuscita: l'ordine è cambiato di stato, riprova." };
  }

  await movimentiDaRighe(supabase, prof.azienda_id, prof.id, righe, "scarico", numero);

  revalidatePath("/cassa");
  revalidatePath("/ordini");
  revalidatePath(tipoOrdine === "busta" ? `/ordini/buste/${ordineId}` : `/ordini/lac/${ordineId}`);
  revalidatePath("/magazzino");
  redirect(`/cassa/vendite/${vend.id}`);
}

/* ── Cassa: caparra (incamero / restituzione) ──────────────────────── */

export async function incameraCaparra(bustaId: string, _prev: Esito, _formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("ordini_occhiali")
    .select("stato, acconto, numero, note, caparra_incamerata_il, azienda_id")
    .eq("id", bustaId)
    .maybeSingle();
  if (!b) return { errore: "Busta non trovata." };
  if (b.stato === "consegnata") return { errore: "Busta già consegnata: non si incamera." };
  if (b.caparra_incamerata_il) return { errore: "Caparra già incamerata." };
  if (b.acconto <= 0) return { errore: "Non c'è caparra da incamerare." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase
    .from("ordini_occhiali")
    .update({
      caparra_incamerata_il: new Date().toISOString(),
      stato: "annullata",
      note: appendiNota(b.note, `— Caparra incamerata ${dataIt()} (mancato ritiro)`),
    })
    .eq("id", bustaId);
  if (error) return { errore: `Operazione non riuscita: ${error.message}` };

  await supabase.from("movimenti_cassa").insert({
    azienda_id: b.azienda_id,
    utente_id: prof.id,
    tipo: "incamero_caparra",
    importo: b.acconto,
    motivo: "Caparra incamerata per mancato ritiro",
    riferimento: b.numero,
  });

  revalidatePath("/cassa");
  revalidatePath(`/ordini/buste/${bustaId}`);
  revalidatePath("/ordini");
  return null;
}

export async function annullaBustaConRestituzione(
  bustaId: string,
  _prev: Esito,
  formData: FormData
): Promise<Esito> {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("ordini_occhiali")
    .select("stato, acconto, numero, note, caparra_incamerata_il, cliente_id, acconto_metodo")
    .eq("id", bustaId)
    .maybeSingle();
  if (!b) return { errore: "Busta non trovata." };
  if (b.stato === "consegnata") return { errore: "Busta già consegnata." };
  if (b.caparra_incamerata_il) return { errore: "Caparra già incamerata: non si restituisce." };
  if (b.acconto <= 0) return { errore: "Non c'è caparra da restituire." };

  const causaleRaw = str(formData, "causale") ?? "modifica_wo";
  const causale = (CAUSALI_RESO as readonly string[]).includes(causaleRaw) ? causaleRaw : "modifica_wo";
  // Metodo di rimborso: quello scelto, o quello dell'incasso, o Contanti (§2.4).
  const metodoRimborso = str(formData, "metodo_rimborso") ?? b.acconto_metodo ?? "Contanti";

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { data: numero, error: eN } = await supabase.rpc("prossimo_numero", { p_prefisso: "RE" });
  if (eN || !numero) return { errore: `Numerazione non riuscita: ${eN?.message ?? "riprova"}` };

  const { data: reso, error } = await supabase
    .from("resi")
    .insert({
      azienda_id: prof.azienda_id,
      cliente_id: b.cliente_id,
      utente_id: prof.id,
      numero,
      tipo: "denaro",
      causale: causale as (typeof CAUSALI_RESO)[number],
      importo: b.acconto,
      metodo_rimborso: metodoRimborso,
      busta_id: bustaId,
      doc_origine_numero: b.numero,
      note: `Restituzione caparra busta ${b.numero}`,
    })
    .select("id")
    .single();
  if (error) return { errore: `Reso non riuscito: ${error.message}` };

  await supabase
    .from("ordini_occhiali")
    .update({ stato: "annullata", note: appendiNota(b.note, `— Annullata ${dataIt()}, caparra restituita (reso ${numero})`) })
    .eq("id", bustaId);

  revalidatePath("/cassa");
  revalidatePath(`/ordini/buste/${bustaId}`);
  revalidatePath("/ordini");
  redirect(`/cassa/resi/${reso.id}`);
}

/* ── Cassa: movimenti ──────────────────────────────────────────────── */

const TIPI_MOV_CASSA_MANUALI = ["prelievo", "spesa", "versamento_cassaforte", "versamento_banca"] as const;

export async function registraMovimentoCassa(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const tipoRaw = str(formData, "tipo") ?? "";
  if (!(TIPI_MOV_CASSA_MANUALI as readonly string[]).includes(tipoRaw)) {
    return { errore: "Tipo di movimento non ammesso." };
  }
  const importo = num(formData, "importo");
  if (importo === null || importo <= 0) return { errore: "L'importo dev'essere positivo." };
  const motivo = str(formData, "motivo");
  if (!motivo) return { errore: "Il motivo è obbligatorio." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase.from("movimenti_cassa").insert({
    azienda_id: prof.azienda_id,
    utente_id: prof.id,
    tipo: tipoRaw as (typeof TIPI_MOV_CASSA_MANUALI)[number],
    importo: euro2(importo),
    motivo,
    riferimento: str(formData, "riferimento"),
  });
  if (error) return { errore: `Movimento non riuscito: ${error.message}` };

  revalidatePath("/cassa");
  return null;
}

/* ── Cassa: chiusura di giornata ───────────────────────────────────── */

export async function chiudiCassa(_prev: Esito, formData: FormData): Promise<Esito> {
  const supabase = await createClient();
  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const oggi = new Date().toISOString().slice(0, 10);
  const inizio = `${oggi}T00:00:00`;
  const fine = `${oggi}T23:59:59`;

  const [{ data: vendite }, { data: resi }, { data: accontiOggi }] = await Promise.all([
    supabase.from("vendite").select("pagamenti, righe, totale").eq("stato", "emessa").gte("data_vendita", inizio).lte("data_vendita", fine),
    supabase.from("resi").select("tipo, metodo_rimborso, importo, busta_id").eq("tipo", "denaro").gte("created_at", inizio).lte("created_at", fine),
    supabase.from("ordini_occhiali").select("acconto, acconto_metodo").gte("acconto_incassato_il", inizio).lte("acconto_incassato_il", fine),
  ]);

  // Sistema per metodo — formula condivisa con la homepage (§2.2): la caparra scalata
  // esce dal conteggio, gli acconti incassati oggi entrano col loro metodo.
  const resiDenaro = resi ?? [];
  const acconti = accontiOggi ?? [];
  const sistemaMetodo = sistemaPerMetodo(vendite ?? [], resiDenaro, acconti);

  // Sistema per aliquota (imponibile+iva = importo lordo per aliquota)
  const sistemaAliquota = new Map<string, number>();
  for (const v of vendite ?? []) {
    for (const r of (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[]) {
      const imp = Math.max(0, r.quantita * r.prezzo_unitario - r.sconto);
      sistemaAliquota.set(r.aliquota, euro2((sistemaAliquota.get(r.aliquota) ?? 0) + imp));
    }
  }

  const fondoApertura = num(formData, "fondo_apertura") ?? 0;
  const contantiContati = num(formData, "contanti_contati") ?? 0;
  const fondoChiusura = num(formData, "fondo_chiusura") ?? 0;

  // Quadratura dichiarata (JSON [{ metodo, dichiarato, causale }])
  let quadRaw: { metodo: string; dichiarato: number; causale?: string }[] = [];
  try {
    const p = JSON.parse(str(formData, "quadratura") ?? "[]");
    if (Array.isArray(p)) quadRaw = p;
  } catch {
    quadRaw = [];
  }

  const quadratura: { metodo: string; sistema: number; dichiarato: number; differenza: number; causale: string | null }[] = [];
  for (const q of quadRaw) {
    const metodo = String(q.metodo);
    if (metodo.toLowerCase() === NOME_CAPARRA) continue; // la caparra non è denaro del giorno
    const isContanti = metodo.toLowerCase() === "contanti";
    const sistema = euro2(sistemaMetodo.get(metodo) ?? 0);
    const dichiarato = euro2(Number(q.dichiarato) || 0);
    const dichiaratoNetto = isContanti ? euro2(dichiarato - fondoApertura) : dichiarato;
    const differenza = euro2(dichiaratoNetto - sistema);
    const causale = q.causale ? String(q.causale).trim() : "";
    if (Math.abs(differenza) > 0.05 && !causale) {
      return { errore: `Serve una causale per lo scarto su "${metodo}" (${differenza.toFixed(2)} €).` };
    }
    quadratura.push({ metodo, sistema, dichiarato, differenza, causale: causale || null });
  }

  // Confronto RT (JSON [{ aliquota, stampante }])
  let confRaw: { aliquota: string; stampante: number }[] = [];
  try {
    const p = JSON.parse(str(formData, "confronto") ?? "[]");
    if (Array.isArray(p)) confRaw = p;
  } catch {
    confRaw = [];
  }
  const confronto_rt = (["4", "22", "esente"] as const).map((a) => {
    const stampante = euro2(Number(confRaw.find((c) => c.aliquota === a)?.stampante) || 0);
    const sistema = euro2(sistemaAliquota.get(a) ?? 0);
    return { aliquota: a, stampante, sistema, differenza: euro2(stampante - sistema) };
  });

  // Caparre del giorno — quattro contatori (§2.4): emesse ancorate all'incasso,
  // rese = restituzioni con busta_id, incamerate dai movimenti dedicati.
  const { data: movIncamero } = await supabase
    .from("movimenti_cassa").select("importo").eq("tipo", "incamero_caparra").gte("created_at", inizio).lte("created_at", fine);
  const caparre = {
    ...contatoriCaparre({
      accontiEmessiOggi: acconti,
      venditeOggi: vendite ?? [],
      resiCaparraOggi: resiDenaro.filter((r) => r.busta_id),
      incameriOggi: movIncamero ?? [],
    }),
    senzaMetodo: caparreSenzaMetodo(acconti),
  };

  const riepilogo = { quadratura, confronto_rt, caparre };

  const { error } = await supabase.from("chiusure_cassa").insert({
    azienda_id: prof.azienda_id,
    data: oggi,
    fondo_apertura: euro2(fondoApertura),
    contanti_contati: euro2(contantiContati),
    fondo_chiusura: euro2(fondoChiusura),
    z_numero: str(formData, "z_numero"),
    riepilogo: riepilogo as unknown as Json,
    note: str(formData, "note"),
    chiusa_da: prof.id,
  });
  if (error) {
    if (error.code === "23505") return { errore: "La giornata di oggi è già stata chiusa." };
    return { errore: `Chiusura non riuscita: ${error.message}` };
  }

  revalidatePath("/cassa");
  revalidatePath("/cassa/chiusure");
  redirect("/cassa/chiusure");
}

/* ── B1 · Fondamenta (Era 2) ────────────────────────────────────────── */
// OGNI azione qui sotto chiama `richiedi()` in TESTA (contratto C2): la UI che
// nasconde un bottone è cortesia, l'enforcement è qui. Le scritture che devono
// essere atomiche (consensi C3, anonimizzazione C1) passano da una RPC: il
// client Supabase non ha transazioni, e quei contratti le pretendono.

/** Mastro consensi (C3). La cache su `clienti` la riallinea la funzione, mai noi. */
export async function registraConsenso(
  clienteId: string,
  dati: {
    tipo: "marketing" | "dati_sanitari";
    azione: "dato" | "revocato";
    canali?: string[] | null;
    modalita?: "penna" | "digitale" | null;
    prescrizioneId?: string | null;
    versione?: string | null;
  }
): Promise<{ ok: true; id: string } | { errore: string }> {
  try {
    await richiedi("anagrafiche_consensi");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("registra_consenso", {
      p_cliente_id: clienteId,
      p_tipo: dati.tipo,
      p_azione: dati.azione,
      p_canali: dati.canali ?? null,
      p_modalita: dati.modalita ?? null,
      p_prescrizione_id: dati.prescrizioneId ?? null,
      p_versione: dati.versione ?? null,
      p_documento_ref: null,
    });
    if (error) return { errore: `Consenso non registrato: ${error.message}` };
    revalidatePath(`/clienti/${clienteId}`);
    return { ok: true, id: data as string };
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Il tasto «revoca»: i richiami COMMERCIALI si fermano subito, gli operativi no. */
export async function revocaMarketing(clienteId: string): Promise<Esito> {
  try {
    await richiedi("anagrafiche_consensi");
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoca_marketing", {
      p_cliente_id: clienteId,
      p_modalita: null,
    });
    if (error) return { errore: `Revoca non riuscita: ${error.message}` };
    revalidatePath(`/clienti/${clienteId}`);
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Relazioni (C4): UNA riga, mai le inverse. */
export async function creaRelazione(
  clienteId: string,
  relativoId: string,
  tipo: string
): Promise<Esito> {
  try {
    await richiedi("anagrafiche_consensi");
    const supabase = await createClient();
    const { error } = await supabase.rpc("crea_relazione", {
      p_cliente_id: clienteId,
      p_relativo_id: relativoId,
      p_tipo: tipo,
      p_note: null,
    });
    if (error) {
      const m = error.message;
      if (m.includes("relazione_con_se_stesso")) return { errore: "Una persona non è parente di sé stessa." };
      if (m.includes("gia_in_relazione")) return { errore: "Fra questi due c'è già una relazione familiare." };
      return { errore: `Relazione non creata: ${m}` };
    }
    revalidatePath(`/clienti/${clienteId}`);
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

export async function eliminaRelazione(id: string, clienteId: string): Promise<Esito> {
  try {
    await richiedi("anagrafiche_consensi");
    const supabase = await createClient();
    // Via RPC: la guardia G1 vieta le cancellazioni dirette in questo file, e
    // la regola non si piega per un caso — l'eccezione si esplicita nella 021.
    const { error } = await supabase.rpc("elimina_relazione", { p_id: id });
    if (error) return { errore: `Relazione non rimossa: ${error.message}` };
    revalidatePath(`/clienti/${clienteId}`);
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** C1 · eliminazione definitiva protetta. Solo titolare/responsabile. */
export async function anonimizzaCliente(clienteId: string): Promise<Esito> {
  try {
    await richiedi("anonimizzazione");
    const supabase = await createClient();
    const { error } = await supabase.rpc("anonimizza_cliente", { p_cliente_id: clienteId });
    if (error) return { errore: `Anonimizzazione non riuscita: ${error.message}` };
    revalidatePath("/clienti");
    revalidatePath(`/clienti/${clienteId}`);
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Oculista al volo alla prima ricetta (M2 f2b). Idempotente. */
export async function creaOculistaAlVolo(
  nome: string,
  studio?: string | null,
  citta?: string | null
): Promise<{ ok: true; id: string } | { errore: string }> {
  try {
    await richiedi("anagrafiche_consensi");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crea_oculista_al_volo", {
      p_nome: nome,
      p_studio: studio ?? null,
      p_citta: citta ?? null,
    });
    if (error) return { errore: `Oculista non aggiunto: ${error.message}` };
    return { ok: true, id: data as string };
  } catch (e) {
    return esitoDaErrore(e);
  }
}

/** Parametri di negozio (M10 §4): qui le POLITICHE escono dal codice. */
export async function scriviParametro(chiave: string, valore: unknown): Promise<Esito> {
  try {
    const ctx = await richiedi("parametri_negozio");
    const supabase = await createClient();
    const { error } = await supabase
      .from("parametri")
      .upsert(
        { azienda_id: ctx.azienda_id, chiave, valore: valore as Json },
        { onConflict: "azienda_id,chiave" }
      );
    if (error) return { errore: `Parametro non salvato: ${error.message}` };
    return null;
  } catch (e) {
    return esitoDaErrore(e);
  }
}
