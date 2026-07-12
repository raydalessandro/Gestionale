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
} from "@/lib/database.types";

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
  const origine = (str(formData, "origine") ?? "interna") as "interna" | "esterna";

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
    .select("stato, note")
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
