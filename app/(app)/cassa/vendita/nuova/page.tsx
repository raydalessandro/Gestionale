import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import WizardVendita, { type RigaV, type PagV } from "@/components/WizardVendita";
import type { RigaOrdineLac } from "@/lib/database.types";

const METODI_BASE = [
  { nome: "Contanti", tipo: "contanti", tracciabile: false, ordine: 1 },
  { nome: "Bancomat", tipo: "elettronico", tracciabile: true, ordine: 2 },
  { nome: "Mastercard", tipo: "elettronico", tracciabile: true, ordine: 3 },
  { nome: "Visa", tipo: "elettronico", tracciabile: true, ordine: 4 },
  { nome: "Bonifico", tipo: "bonifico", tracciabile: true, ordine: 5 },
  { nome: "Gift Card", tipo: "buono", tracciabile: true, ordine: 6 },
  { nome: "Assicurazione", tipo: "assicurazione", tracciabile: true, ordine: 7 },
  { nome: "Caparra", tipo: "caparra", tracciabile: true, ordine: 8 },
];

const riga = (over: Partial<RigaV>): RigaV => ({
  prodotto_id: null, descrizione: "", quantita: "1", prezzo_unitario: "0", sconto: "0", aliquota: "22", dm: false, ...over,
});

export default async function NuovaVenditaPage({
  searchParams,
}: {
  searchParams: Promise<{ busta?: string; lac?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Metodi attivi (seed se mancano del tutto)
  let { data: metodi } = await supabase.from("metodi_pagamento").select("id, nome, tipo, attivo, ordine").order("ordine");
  if (!metodi || metodi.length === 0) {
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = u.user ? await supabase.from("utenti").select("azienda_id").eq("id", u.user.id).maybeSingle() : { data: null };
    if (prof) {
      await supabase.from("metodi_pagamento").insert(METODI_BASE.map((m) => ({ ...m, tipo: m.tipo as never, azienda_id: prof.azienda_id })));
      ({ data: metodi } = await supabase.from("metodi_pagamento").select("id, nome, tipo, attivo, ordine").order("ordine"));
    }
  }
  const metodiAttivi = (metodi ?? []).filter((m) => m.attivo).map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo }));

  let righeIniziali: RigaV[] | undefined;
  let pagamentiIniziali: PagV[] | undefined;
  let clientePre: { id: string; nome: string; cognome: string; codice_fiscale?: string | null } | null = null;
  let consegna: { tipo: "busta" | "lac"; id: string } | null = null;
  let cfIniziale: string | null = null;

  if (sp.busta) {
    const { data: b } = await supabase.from("ordini_occhiali").select("*").eq("id", sp.busta).maybeSingle();
    if (b) {
      consegna = { tipo: "busta", id: b.id };
      const aliqMont = b.tipo_lavoro === "solo_montatura" ? "22" : "4";
      const rr: RigaV[] = [];
      if (b.prezzo_montatura > 0 || b.prezzo_lenti > 0) {
        if (b.prezzo_montatura > 0) rr.push(riga({ descrizione: `Montatura ${[b.montatura_marca, b.montatura_modello].filter(Boolean).join(" ")}`.trim(), prezzo_unitario: String(b.prezzo_montatura), aliquota: aliqMont, dm: true }));
        if (b.prezzo_lenti > 0) rr.push(riga({ descrizione: `Lenti${b.lente_tipo ? ` ${b.lente_tipo}` : ""}${b.lente_indice ? ` ${b.lente_indice}` : ""}`.trim(), prezzo_unitario: String(b.prezzo_lenti), aliquota: "4", dm: true }));
        if (b.prezzo_extra > 0) rr.push(riga({ descrizione: b.garanzia ? `Extra / ${b.garanzia}` : "Extra", prezzo_unitario: String(b.prezzo_extra), aliquota: "22", dm: false }));
        if (b.sconto > 0 && rr.length > 0) rr[0].sconto = String(b.sconto);
      } else {
        rr.push(riga({ descrizione: `Occhiale — ${b.numero}`, prezzo_unitario: String(b.totale), aliquota: aliqMont, dm: true }));
      }
      righeIniziali = rr;
      if (b.acconto > 0) pagamentiIniziali = [{ metodo_id: null, nome: "Caparra", importo: String(b.acconto), consegnato: "" }];
      if (b.cliente_id) {
        const { data: c } = await supabase.from("clienti").select("id, nome, cognome, codice_fiscale").eq("id", b.cliente_id).maybeSingle();
        clientePre = c;
        cfIniziale = c?.codice_fiscale ?? null;
      }
    }
  } else if (sp.lac) {
    const { data: o } = await supabase.from("ordini_lac").select("*").eq("id", sp.lac).maybeSingle();
    if (o) {
      consegna = { tipo: "lac", id: o.id };
      const righe = (Array.isArray(o.righe) ? o.righe : []) as RigaOrdineLac[];
      righeIniziali = righe.map((r) => riga({ prodotto_id: r.prodotto_id ?? null, descrizione: r.descrizione, quantita: String(r.quantita), prezzo_unitario: String(r.prezzo), aliquota: "4", dm: true }));
      if (righeIniziali.length === 0) righeIniziali = [riga({ descrizione: `Lenti a contatto — ${o.numero}`, prezzo_unitario: String(o.totale), aliquota: "4", dm: true })];
      if (o.acconto > 0) pagamentiIniziali = [{ metodo_id: null, nome: "Caparra", importo: String(o.acconto), consegnato: "" }];
      if (o.cliente_id) {
        const { data: c } = await supabase.from("clienti").select("id, nome, cognome, codice_fiscale").eq("id", o.cliente_id).maybeSingle();
        clientePre = c;
        cfIniziale = c?.codice_fiscale ?? null;
      }
    }
  }

  return (
    <>
      <PageHeader
        titolo={consegna ? "Consegna e incassa" : "Vendita veloce"}
        sotto={consegna ? "Righe già composte dall'ordine: correggi se serve, poi incassa." : "Registra l'incasso. Il cliente è facoltativo."}
      />
      <WizardVendita
        clientePreselezionato={clientePre}
        metodi={metodiAttivi}
        righeIniziali={righeIniziali}
        pagamentiIniziali={pagamentiIniziali}
        cfIniziale={cfIniziale}
        consegna={consegna}
      />
    </>
  );
}
