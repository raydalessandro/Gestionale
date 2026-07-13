import type { createClient } from "@/lib/supabase/server";
import type { RichiamoRow } from "@/lib/database.types";
import { scadenzaRx } from "@/lib/utils";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type Proposta = {
  tipo: RichiamoRow["tipo"];
  cliente_id: string;
  clienteNome: string;
  telefono: string | null;
  commerciale: boolean;
  motivo: string;
  riferimento: string | null;
  valore: number | null;
};

export type RisultatoProposte = {
  proposte: Proposta[];
  nascosteCommerciali: number;
};

const GG = 24 * 60 * 60 * 1000;
const isoData = (d: Date) => d.toISOString().slice(0, 10);
const giorniFa = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / GG);

/**
 * Calcola al volo le proposte di richiamo dai dati (§2.2–2.4): nessun cron.
 * Applica GDPR (§2.3) e dedupe contro i richiami esistenti (§2.4).
 */
export async function calcolaProposte(
  supabase: SupabaseServer
): Promise<RisultatoProposte> {
  const ora = new Date();
  const oggiIso = isoData(ora);
  const treGgFa = new Date(Date.now() - 3 * GG).toISOString();
  const cento = isoData(new Date(Date.now() - 100 * GG));
  const settanta = isoData(new Date(Date.now() - 70 * GG));
  const rxDa = isoData(new Date(Date.now() - 15 * GG));
  const rxA = isoData(new Date(Date.now() + 30 * GG));
  const quindiciFa = new Date(Date.now() - 15 * GG).toISOString();

  const [
    bustePronte,
    busteRitardo,
    lacArrivati,
    lacConsegnati,
    lacTuttiAttivi,
    prescrizioni,
    contrFuturi,
    fermiScaduti,
    richiamiEsistenti,
  ] = await Promise.all([
    supabase.from("ordini_occhiali").select("numero, cliente_id, saldo, avvisato_il").eq("stato", "pronta"),
    supabase.from("ordini_occhiali").select("numero, cliente_id, saldo, data_promessa").in("stato", ["lavorazione", "arrivata"]).lt("data_promessa", oggiIso),
    supabase.from("ordini_lac").select("numero, cliente_id, totale, acconto, avvisato_il").eq("stato", "arrivato"),
    supabase.from("ordini_lac").select("numero, cliente_id, totale, created_at").eq("stato", "consegnato").gte("data_consegna", `${cento}T00:00:00Z`).lte("data_consegna", `${settanta}T23:59:59Z`),
    supabase.from("ordini_lac").select("cliente_id, created_at").neq("stato", "annullato"),
    supabase.from("prescrizioni").select("cliente_id, data_visita, validita_mesi").eq("attiva", true),
    supabase.from("appuntamenti").select("cliente_id").eq("tipo", "controllo_vista").eq("stato", "prenotato").gt("inizio", ora.toISOString()),
    supabase.from("fermi").select("prodotto_id, cliente_id, quantita, scade_il").eq("stato", "attivo").lt("scade_il", oggiIso),
    supabase.from("richiami").select("tipo, cliente_id, riferimento, esito, fatto_il").or(`esito.is.null,fatto_il.gte.${quindiciFa}`),
  ]);

  // Prezzi prodotti per i fermi
  const prodIds = [...new Set((fermiScaduti.data ?? []).map((f) => f.prodotto_id))];
  const { data: prodotti } = prodIds.length
    ? await supabase.from("prodotti").select("id, prezzo").in("id", prodIds)
    : { data: [] };
  const prezzoProd = new Map((prodotti ?? []).map((p) => [p.id, p.prezzo]));

  // Ultimo ordine LAC (non annullato) per cliente → per lac_esaurimento
  const ultimoLac = new Map<string, string>();
  for (const o of lacTuttiAttivi.data ?? []) {
    if (!o.cliente_id) continue;
    const prec = ultimoLac.get(o.cliente_id);
    if (!prec || o.created_at > prec) ultimoLac.set(o.cliente_id, o.created_at);
  }

  // Clienti con controllo vista futuro
  const conControlloFuturo = new Set((contrFuturi.data ?? []).map((a) => a.cliente_id).filter(Boolean));

  // ── Costruzione proposte grezze ──────────────────────────────────
  type Grezza = Omit<Proposta, "clienteNome" | "telefono" | "commerciale">;
  const grezze: Grezza[] = [];

  // ritiro_sollecito — buste pronte non avvisate o avvisate da > 3gg
  for (const b of bustePronte.data ?? []) {
    if (!b.cliente_id) continue;
    if (b.avvisato_il && b.avvisato_il >= treGgFa) continue;
    grezze.push({
      tipo: "ritiro_sollecito",
      cliente_id: b.cliente_id,
      motivo: b.avvisato_il
        ? `Busta ${b.numero} pronta, avvisata da ${giorniFa(b.avvisato_il)} giorni`
        : `Busta ${b.numero} pronta, non ancora avvisata`,
      riferimento: b.numero,
      valore: b.saldo,
    });
  }
  // ritiro_sollecito — LAC arrivati non avvisati o avvisati da > 3gg
  for (const o of lacArrivati.data ?? []) {
    if (!o.cliente_id) continue;
    if (o.avvisato_il && o.avvisato_il >= treGgFa) continue;
    grezze.push({
      tipo: "ritiro_sollecito",
      cliente_id: o.cliente_id,
      motivo: o.avvisato_il
        ? `Ordine ${o.numero} arrivato, avvisato da ${giorniFa(o.avvisato_il)} giorni`
        : `Ordine ${o.numero} arrivato, non ancora avvisato`,
      riferimento: o.numero,
      valore: o.totale - o.acconto,
    });
  }
  // promessa_ritardo — buste in ritardo
  for (const b of busteRitardo.data ?? []) {
    if (!b.cliente_id) continue;
    grezze.push({
      tipo: "promessa_ritardo",
      cliente_id: b.cliente_id,
      motivo: `Busta ${b.numero} promessa per il ${b.data_promessa}, in ritardo`,
      riferimento: b.numero,
      valore: b.saldo,
    });
  }
  // lac_esaurimento — consegnati 70–100gg fa e nessun ordine LAC più recente
  for (const o of lacConsegnati.data ?? []) {
    if (!o.cliente_id) continue;
    if (ultimoLac.get(o.cliente_id) !== o.created_at) continue;
    grezze.push({
      tipo: "lac_esaurimento",
      cliente_id: o.cliente_id,
      motivo: `LAC dell'ordine ${o.numero} probabilmente in esaurimento`,
      riferimento: o.numero,
      valore: o.totale,
    });
  }
  // controllo_vista — Rx in scadenza e senza appuntamento futuro
  for (const p of prescrizioni.data ?? []) {
    if (!p.cliente_id) continue;
    const scad = isoData(scadenzaRx(p));
    if (scad < rxDa || scad > rxA) continue;
    if (conControlloFuturo.has(p.cliente_id)) continue;
    grezze.push({
      tipo: "controllo_vista",
      cliente_id: p.cliente_id,
      motivo: `Prescrizione in scadenza il ${scad}`,
      riferimento: null,
      valore: null,
    });
  }
  // fermo_scadenza — fermi attivi scaduti
  for (const f of fermiScaduti.data ?? []) {
    grezze.push({
      tipo: "fermo_scadenza",
      cliente_id: f.cliente_id,
      motivo: `Fermo scaduto il ${f.scade_il}`,
      riferimento: null,
      valore: (prezzoProd.get(f.prodotto_id) ?? 0) * f.quantita,
    });
  }

  // ── Dati cliente + GDPR + dedupe ─────────────────────────────────
  const clienteIds = [...new Set(grezze.map((g) => g.cliente_id))];
  const { data: clienti } = clienteIds.length
    ? await supabase.from("clienti").select("id, nome, cognome, telefono, consenso_marketing").in("id", clienteIds)
    : { data: [] };
  const infoCliente = new Map((clienti ?? []).map((c) => [c.id, c]));

  const bloccati = new Set(
    (richiamiEsistenti.data ?? []).map((r) => `${r.tipo}|${r.cliente_id}|${r.riferimento ?? ""}`)
  );

  const COMMERCIALI = new Set(["controllo_vista", "lac_esaurimento"]);
  const proposte: Proposta[] = [];
  let nascosteCommerciali = 0;

  for (const g of grezze) {
    const c = infoCliente.get(g.cliente_id);
    if (!c) continue;
    if (bloccati.has(`${g.tipo}|${g.cliente_id}|${g.riferimento ?? ""}`)) continue;

    const commerciale = COMMERCIALI.has(g.tipo);
    if (commerciale && !c.consenso_marketing) {
      nascosteCommerciali++;
      continue;
    }
    proposte.push({
      ...g,
      commerciale,
      clienteNome: `${c.cognome} ${c.nome}`,
      telefono: c.telefono,
    });
  }

  return { proposte, nascosteCommerciali };
}
