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
} from "@/lib/database.types";
import { ivaScorporo } from "@/components/CassaUI";

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
  const consenso = fd.get("consenso_marketing") === "on";
  return {
    nome: str(fd, "nome") ?? "",
    cognome: str(fd, "cognome") ?? "",
    data_nascita: str(fd, "data_nascita"),
    codice_fiscale: str(fd, "codice_fiscale")?.toUpperCase() ?? null,
    email: str(fd, "email"),
    telefono: str(fd, "telefono"),
    indirizzo: str(fd, "indirizzo"),
    citta: str(fd, "citta"),
    cap: str(fd, "cap"),
    provincia: str(fd, "provincia")?.toUpperCase() ?? null,
    fonte: (str(fd, "fonte") ?? "banco") as
      | "banco" | "sito" | "app" | "convenzione" | "import",
    consenso_marketing: consenso,
    data_consenso: consenso ? new Date().toISOString() : null,
    note: str(fd, "note"),
  };
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

/* ── Prescrizioni ──────────────────────────────────────────────────── */

export async function creaPrescrizione(
  clienteId: string,
  _prev: { errore: string } | null,
  formData: FormData
): Promise<{ errore: string } | null> {
  const supabase = await createClient();

  const tipo = (str(formData, "tipo") ?? "occhiali") as "occhiali" | "lac";
  const origine = (str(formData, "origine") ?? "interna") as
    | "interna"
    | "esterna"
    | "lenti_precedenti";

  const asseValido = (v: number | null) =>
    v === null || (v >= 0 && v <= 180);

  const od_asse = num(formData, "od_asse");
  const os_asse = num(formData, "os_asse");
  if (!asseValido(od_asse) || !asseValido(os_asse)) {
    return { errore: "L'asse deve essere compreso tra 0 e 180." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Sessione scaduta: rifai il login." };

  const { data: utenteRow } = await supabase
    .from("utenti")
    .select("id, azienda_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!utenteRow) return { errore: "Profilo non trovato: rifai il login." };

  const { error } = await supabase.from("prescrizioni").insert({
    azienda_id: utenteRow.azienda_id,
    cliente_id: clienteId,
    tipo,
    data_visita: str(formData, "data_visita") ?? new Date().toISOString().slice(0, 10),
    utente_id: origine === "interna" ? utenteRow.id : null,
    origine,
    esaminatore: origine === "esterna" ? str(formData, "esaminatore") : null,
    uso: (str(formData, "uso") as
      | "lontano" | "vicino" | "progressivo" | "bifocale" | "office"
      | null) ?? null,
    od_sfero: num(formData, "od_sfero"),
    od_cilindro: num(formData, "od_cilindro"),
    od_asse,
    os_sfero: num(formData, "os_sfero"),
    os_cilindro: num(formData, "os_cilindro"),
    os_asse,
    addizione: num(formData, "addizione"),
    od_prisma: tipo === "occhiali" ? num(formData, "od_prisma") : null,
    od_prisma_base: tipo === "occhiali" ? (str(formData, "od_prisma_base") as PrismaBase | null) : null,
    os_prisma: tipo === "occhiali" ? num(formData, "os_prisma") : null,
    os_prisma_base: tipo === "occhiali" ? (str(formData, "os_prisma_base") as PrismaBase | null) : null,
    od_raggio: tipo === "lac" ? num(formData, "od_raggio") : null,
    od_diametro: tipo === "lac" ? num(formData, "od_diametro") : null,
    os_raggio: tipo === "lac" ? num(formData, "os_raggio") : null,
    os_diametro: tipo === "lac" ? num(formData, "os_diametro") : null,
    validita_mesi: num(formData, "validita_mesi") ?? 12,
    note: str(formData, "note"),
  });

  if (error) return { errore: `Salvataggio non riuscito: ${error.message}` };

  revalidatePath(`/clienti/${clienteId}`);
  redirect(`/clienti/${clienteId}`);
}

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
      prezzo_extra,
      sconto,
      totale,
      acconto,
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
    .select("stato, note, totale")
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
  "lente",
  "accessorio",
  "servizio",
] as const;

function prodottoDaForm(fd: FormData) {
  const tipoRaw = str(fd, "tipo") ?? "accessorio";
  const tipo = (TIPI_PRODOTTO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as (typeof TIPI_PRODOTTO)[number])
    : "accessorio";

  // parametri LAC (§2.10); per gli altri tipi resta {}.
  const parametri: Record<string, unknown> =
    tipo === "lac"
      ? {
          raggio: num(fd, "par_raggio"),
          diametro: num(fd, "par_diametro"),
          confezione: str(fd, "par_confezione"),
        }
      : {};

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

  // 1) carico = quantità IN BOLLA (riferimento = n° bolla)
  const { error: e1 } = await supabase.from("movimenti_magazzino").insert({
    azienda_id: prof.azienda_id,
    prodotto_id: prodottoId,
    utente_id: prof.id,
    tipo: "carico",
    quantita: qBolla,
    riferimento: bolla ? `Bolla ${bolla}` : "Carico",
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
  const supabase = await createClient();
  const tipo = str(formData, "tipo");
  const q = Math.round(num(formData, "quantita") ?? 0);
  if (q < 1) return { errore: "La quantità dev'essere almeno 1." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  let quantita: number;
  let note: string | null;
  let riferimento: string | null = str(formData, "riferimento");
  let tipoFinale: TipoMovimento;

  if (tipo === "rettifica") {
    const motivo = str(formData, "motivo");
    if (!motivo) return { errore: "La rettifica richiede un motivo." };
    quantita = str(formData, "direzione") === "-" ? -q : q;
    note = motivo;
    riferimento = null;
    tipoFinale = "rettifica";
  } else if ((MOVIMENTI_MANUALI as readonly string[]).includes(tipo ?? "")) {
    quantita = -q;
    note = str(formData, "motivo");
    tipoFinale = tipo as TipoMovimento;
  } else {
    return { errore: "Tipo di movimento non ammesso." };
  }

  const { error } = await supabase.from("movimenti_magazzino").insert({
    azienda_id: prof.azienda_id,
    prodotto_id: prodottoId,
    utente_id: prof.id,
    tipo: tipoFinale,
    quantita,
    riferimento,
    note,
  });
  if (error) return { errore: `Movimento non riuscito: ${error.message}` };

  revalidatePath("/magazzino");
  revalidatePath(`/magazzino/prodotti/${prodottoId}`);
  return null;
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

  const inizio = new Date(`${data}T${ora}`);
  if (Number.isNaN(inizio.getTime())) return { errore: "Data o ora non valide." };

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
    inizio: inizio.toISOString(),
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
    .select("stato, righe, numero, note, azienda_id")
    .eq("id", id)
    .maybeSingle();
  if (!v) return { errore: "Vendita non trovata." };
  if (v.stato !== "emessa") return { errore: "La vendita è già annullata." };
  const motivo = str(formData, "motivo");
  if (!motivo) return { errore: "Indica un motivo per l'annullo." };

  const prof = await profiloCorrente(supabase);
  if ("errore" in prof) return prof;

  const { error } = await supabase
    .from("vendite")
    .update({ stato: "annullata", note: appendiNota(v.note, `— Annullata ${dataIt()}: ${motivo}`) })
    .eq("id", id);
  if (error) return { errore: `Annullo non riuscito: ${error.message}` };

  const righe = (Array.isArray(v.righe) ? v.righe : []) as RigaVendita[];
  await movimentiDaRighe(supabase, v.azienda_id, prof.id, righe, "carico", `Annullo ${v.numero}`);

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
    .select("stato, acconto, numero, note, caparra_incamerata_il, cliente_id")
    .eq("id", bustaId)
    .maybeSingle();
  if (!b) return { errore: "Busta non trovata." };
  if (b.stato === "consegnata") return { errore: "Busta già consegnata." };
  if (b.caparra_incamerata_il) return { errore: "Caparra già incamerata: non si restituisce." };
  if (b.acconto <= 0) return { errore: "Non c'è caparra da restituire." };

  const causaleRaw = str(formData, "causale") ?? "modifica_wo";
  const causale = (CAUSALI_RESO as readonly string[]).includes(causaleRaw) ? causaleRaw : "modifica_wo";
  const metodoRimborso = str(formData, "metodo_rimborso") ?? "Contanti";

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

  const [{ data: vendite }, { data: resi }] = await Promise.all([
    supabase.from("vendite").select("pagamenti, righe, totale").eq("stato", "emessa").gte("data_vendita", inizio).lte("data_vendita", fine),
    supabase.from("resi").select("tipo, metodo_rimborso, importo").eq("tipo", "denaro").gte("created_at", inizio).lte("created_at", fine),
  ]);

  // Sistema per metodo
  const sistemaMetodo = new Map<string, number>();
  for (const v of vendite ?? []) {
    for (const p of (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[]) {
      sistemaMetodo.set(p.nome, euro2((sistemaMetodo.get(p.nome) ?? 0) + p.importo));
    }
  }
  for (const r of resi ?? []) {
    const m = r.metodo_rimborso ?? "Contanti";
    sistemaMetodo.set(m, euro2((sistemaMetodo.get(m) ?? 0) - r.importo));
  }

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

  // Caparre del giorno
  const [{ data: ordiniOggi }, { data: movIncamero }] = await Promise.all([
    supabase.from("ordini_occhiali").select("acconto").gte("created_at", inizio).lte("created_at", fine),
    supabase.from("movimenti_cassa").select("importo").eq("tipo", "incamero_caparra").gte("created_at", inizio).lte("created_at", fine),
  ]);
  const caparreEmesse = euro2((ordiniOggi ?? []).reduce((s, o) => s + (o.acconto ?? 0), 0));
  let caparreScontate = 0;
  for (const v of vendite ?? []) {
    for (const p of (Array.isArray(v.pagamenti) ? v.pagamenti : []) as PagamentoVendita[]) {
      if (p.nome.toLowerCase() === "caparra") caparreScontate = euro2(caparreScontate + p.importo);
    }
  }
  const caparreIncamerate = euro2((movIncamero ?? []).reduce((s, m) => s + m.importo, 0));

  const riepilogo = {
    quadratura,
    confronto_rt,
    caparre: { emesse: caparreEmesse, scontate: caparreScontate, incamerate: caparreIncamerate },
  };

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
