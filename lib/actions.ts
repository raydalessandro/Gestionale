"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PrismaBase } from "@/lib/database.types";

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
