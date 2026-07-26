"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { controllaLimite } from "@/lib/ratelimit";

/**
 * Azione server della prenotazione (G7). Il browser NON chiama mai
 * `crea_prenotazione` direttamente: passa da qui, che (1) applica il limite di
 * frequenza, (2) rivalida gli ingressi, (3) chiama la funzione e traduce
 * l'errore. Se la scrittura fosse esposta al browser, il rate limit sarebbe
 * aggirabile e avremmo un modulo di spam col nostro marchio.
 */

export type DatiPrenotazione = {
  slug: string;
  servizio: string;
  inizioISO: string;
  nome: string;
  telefono: string;
  email: string;
  perContoDi: string;
  note: string;
  fonte: string;
  chiaveRichiesta: string;
  informativa: boolean;
  listaAttesa: boolean;
};

export type RisultatoPrenota =
  | { ok: true; codice: string; inizioISO: string; durata: number }
  | { ok: false; errore: string };

/** Normalizzazione leggera SOLO per la chiave di rate limit (il dedup vero è nel DB). */
function chiaveTelefono(t: string): string {
  const s = t.replace(/[^0-9+]/g, "");
  return s.startsWith("+") ? s : s ? `+39${s}` : "";
}

/** Traduce gli errori distinti della funzione in messaggi per la persona. */
function messaggioErrore(raw: string): string {
  if (raw.includes("SLOT_OCCUPATO")) return "Quell'orario è stato appena preso. Scegline un altro.";
  if (raw.includes("SERVIZIO_NON_ATTIVO")) return "Questo servizio non è più disponibile in questo negozio.";
  if (raw.includes("FUORI_ORARIO")) return "Quell'orario è fuori dagli orari di apertura.";
  if (raw.includes("FUORI_ORIZZONTE")) return "Quella data è troppo in là. Scegli un giorno più vicino.";
  if (raw.includes("TROPPO_TARDI")) return "Serve almeno un paio d'ore di anticipo. Scegli un orario più avanti.";
  if (raw.includes("NEGOZIO_NON_TROVATO")) return "Questo negozio non è disponibile per la prenotazione online.";
  return "Non siamo riusciti a registrare la richiesta. Riprova fra poco.";
}

export async function inviaPrenotazione(dati: DatiPrenotazione): Promise<RisultatoPrenota> {
  // 1 · Limite di frequenza (IP + telefono). Chiave IP dagli header del proxy.
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const esito = controllaLimite({ ip, telefono: chiaveTelefono(dati.telefono) });
  if (!esito.ok) {
    return { ok: false, errore: "Troppe richieste in poco tempo. Riprova fra qualche minuto." };
  }

  // 2 · Rivalida lato server: non fidarsi di niente che arriva dal modulo.
  const nome = dati.nome?.trim() ?? "";
  const telefono = dati.telefono?.trim() ?? "";
  if (!dati.slug || !dati.servizio || !dati.inizioISO || !nome || !telefono) {
    return { ok: false, errore: "Mancano dei dati. Torna indietro e completa i campi." };
  }
  if (!dati.informativa) {
    return { ok: false, errore: "Per procedere serve accettare l'informativa." };
  }
  if (!dati.chiaveRichiesta) {
    return { ok: false, errore: "Richiesta non valida. Ricarica la pagina e riprova." };
  }

  // 3 · Chiama la funzione con la chiave anon (nessun service role).
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase.rpc("crea_prenotazione", {
    p_slug: dati.slug,
    p_servizio: dati.servizio,
    p_inizio: dati.inizioISO,
    p_nome: nome,
    p_telefono: telefono,
    p_email: dati.email?.trim() ?? "",
    p_per_conto_di: dati.perContoDi?.trim() ?? "",
    p_note: dati.note?.trim() ?? "",
    p_fonte: dati.fonte,
    p_chiave_richiesta: dati.chiaveRichiesta,
    p_lista_attesa: dati.listaAttesa,
  });

  if (error) return { ok: false, errore: messaggioErrore(error.message) };
  const riga = Array.isArray(data) ? data[0] : data;
  if (!riga) return { ok: false, errore: messaggioErrore("") };

  return {
    ok: true,
    codice: riga.codice as string,
    inizioISO: riga.inizio as string,
    durata: riga.durata_minuti as number,
  };
}
