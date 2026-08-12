"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esitoDaErrore, richiedi } from "@/lib/permessi";
import { calcolaScadenzaProposta } from "@/lib/prescrizioni-conversioni";
import type {
  OriginePrescrizione,
  PrismaBase,
  TipologiaOcchiali,
} from "@/lib/database.types";

type EsitoPrescrizione = { errore: string } | null;

const ORIGINI: readonly OriginePrescrizione[] = [
  "check_up",
  "lenti_cliente",
  "ricetta_oculistica",
  "prescrizione_precedente",
];
const TIPOLOGIE: readonly TipologiaOcchiali[] = [
  "lontano",
  "vicino",
  "intermedio",
  "bifocale",
  "progressivo",
  "progressiva",
  "office",
  "trifocale",
  "mista",
];
const TIPOLOGIE_PER_OCCHIO = [
  "lontano",
  "vicino",
  "intermedio",
  "bifocale",
  "progressivo",
  "progressiva",
  "office",
  "trifocale",
] as const;
const BASI_PRISMA: readonly PrismaBase[] = [
  "interna",
  "esterna",
  "superiore",
  "inferiore",
];
const SPECIALI = new Set([
  "bangerter",
  "occlusione",
  "filtro_medicale",
  "tinta_terapeutica",
  "altro",
]);
const TIPOLOGIE_LAC = new Set([
  "monofocale",
  "multifocale",
  "rigida",
  "semirigida",
  "specialistica",
]);
const SOTTOTIPI_LAC = new Set([
  "sclerale",
  "ortocheratologia",
  "cheratocono",
  "ibrida",
  "altro",
]);
const GEOMETRIE_LAC = new Set(["sferica", "torica"]);

function testo(fd: FormData, chiave: string): string | null {
  const valore = fd.get(chiave);
  if (typeof valore !== "string") return null;
  const pulito = valore.trim();
  return pulito === "" ? null : pulito;
}

function numero(fd: FormData, chiave: string): number | null {
  const valore = testo(fd, chiave);
  if (valore === null) return null;
  const numeroLetto = Number(valore.replace(",", "."));
  return Number.isFinite(numeroLetto) ? numeroLetto : null;
}

function checkbox(fd: FormData, chiave: string): boolean {
  return fd.get(chiave) === "on";
}

function appartieneA<T extends string>(valore: string | null, insieme: readonly T[]): valore is T {
  return valore !== null && insieme.includes(valore as T);
}

function validaAsse(valore: number | null): boolean {
  return valore === null || (valore >= 0 && valore <= 180);
}

function validaPrisma(valore: number | null, base: string | null): string | null {
  if ((valore === null) !== (base === null)) return "Prisma e base devono essere compilati insieme per ogni occhio.";
  if (base !== null && !appartieneA(base, BASI_PRISMA)) return "La base prisma selezionata non è valida.";
  return null;
}

/**
 * Salva una scheda clinico-operativa M2.
 *
 * `tipo` rimane volutamente un marcatore legacy: la decisione di regia impone
 * `occhiali` quando la sezione Occhiali è presente (plano incluso), `lac` solo
 * per una scheda esclusivamente LAC. Le nuove letture usano sezioni e righe LAC.
 */
export async function salvaSchedaUnica(
  clienteId: string,
  _precedente: EsitoPrescrizione,
  formData: FormData
): Promise<EsitoPrescrizione> {
  let destinazione: string | null = null;
  try {
    const contesto = await richiedi("prescrizioni");
    const supabase = await createClient();

    const haLac = checkbox(formData, "ha_lac");
    const plano = checkbox(formData, "plano");
    const haOcchiali = checkbox(formData, "ha_occhiali") || plano;
    if (!haOcchiali && !haLac) {
      return { errore: "Attiva almeno una sezione: Occhiali, LAC oppure Plano." };
    }

    const origineRaw = testo(formData, "origine") ?? "check_up";
    if (!appartieneA(origineRaw, ORIGINI)) return { errore: "L'origine selezionata non è valida." };

    const tipologiaRaw = testo(formData, "tipologia");
    if (haOcchiali && !appartieneA(tipologiaRaw, TIPOLOGIE)) {
      return { errore: "Scegli la tipologia della sezione Occhiali." };
    }
    const tipologia = tipologiaRaw as TipologiaOcchiali | null;
    let tipologiaOd: (typeof TIPOLOGIE_PER_OCCHIO)[number] | null = null;
    let tipologiaOs: (typeof TIPOLOGIE_PER_OCCHIO)[number] | null = null;
    if (tipologia === "mista") {
      const odRaw = testo(formData, "tipologia_od");
      const osRaw = testo(formData, "tipologia_os");
      if (!appartieneA(odRaw, TIPOLOGIE_PER_OCCHIO) || !appartieneA(osRaw, TIPOLOGIE_PER_OCCHIO)) {
        return { errore: "Per la tipologia mista scegli una destinazione valida per OD e OS." };
      }
      tipologiaOd = odRaw;
      tipologiaOs = osRaw;
    }

    const dataVisita = testo(formData, "data_visita") ?? new Date().toISOString().slice(0, 10);
    const validitaMesi = numero(formData, "validita_mesi") ?? 12;
    if (validitaMesi <= 0 || validitaMesi > 60) return { errore: "La validità deve essere compresa tra 1 e 60 mesi." };
    const scadenzaProposta = calcolaScadenzaProposta(dataVisita, validitaMesi);
    const dataScadenzaRichiesta = testo(formData, "data_scadenza");
    const dataScadenza = dataScadenzaRichiesta ?? scadenzaProposta;
    const scadenzaModificata = dataScadenza !== scadenzaProposta;

    const odAsse = numero(formData, "od_asse");
    const osAsse = numero(formData, "os_asse");
    if (!validaAsse(odAsse) || !validaAsse(osAsse)) {
      return { errore: "L'asse deve essere compreso tra 0 e 180." };
    }

    const odPrisma = numero(formData, "od_prisma");
    const osPrisma = numero(formData, "os_prisma");
    const odPrismaBase = testo(formData, "od_prisma_base");
    const osPrismaBase = testo(formData, "os_prisma_base");
    const errorePrisma = validaPrisma(odPrisma, odPrismaBase) ?? validaPrisma(osPrisma, osPrismaBase);
    if (errorePrisma) return { errore: errorePrisma };

    const speciali = formData
      .getAll("speciali")
      .filter((valore): valore is string => typeof valore === "string" && SPECIALI.has(valore));
    const haAltro = speciali.includes("altro");
    if (haAltro && !testo(formData, "speciali_note")) {
      return { errore: "Descrivi la prescrizione speciale selezionata come «altro»." };
    }

    let oculistaId = testo(formData, "oculista_id");
    const nuovoOculista = testo(formData, "oculista_nome");
    if (origineRaw === "ricetta_oculistica" && !oculistaId && nuovoOculista) {
      const { data, error } = await supabase.rpc("crea_oculista_al_volo", {
        p_nome: nuovoOculista,
        p_studio: testo(formData, "oculista_studio"),
        p_citta: testo(formData, "oculista_citta"),
      });
      if (error || !data) return { errore: `Oculista non salvato: ${error?.message ?? "risposta vuota"}` };
      oculistaId = data as string;
    }
    if (origineRaw === "ricetta_oculistica" && !oculistaId) {
      return { errore: "Per una ricetta oculistica seleziona o inserisci l'oculista." };
    }

    if (!checkbox(formData, "consenso_sanitario")) {
      return { errore: "È necessaria la firma del consenso dati sanitari per questa prescrizione." };
    }

    const rettificaDi = testo(formData, "rettifica_di");
    const rettificaNatura = testo(formData, "rettifica_natura") ?? "clinica";
    if (rettificaNatura !== "clinica" && rettificaNatura !== "digitazione") {
      return { errore: "La natura della rettifica non è valida." };
    }
    if (rettificaDi) {
      const { data: origineRettifica } = await supabase
        .from("prescrizioni")
        .select("id")
        .eq("id", rettificaDi)
        .eq("cliente_id", clienteId)
        .eq("azienda_id", contesto.azienda_id)
        .maybeSingle();
      if (!origineRettifica) return { errore: "La prescrizione da rettificare non appartiene a questo cliente." };
    }

    const odInvariato = checkbox(formData, "od_invariato");
    const osInvariato = checkbox(formData, "os_invariato");
    const { data: precedente } = (odInvariato || osInvariato)
      ? await supabase
          .from("prescrizioni")
          .select("od_sfero, od_cilindro, od_asse, os_sfero, os_cilindro, os_asse, od_add, os_add, od_visus, os_visus")
          .eq("cliente_id", clienteId)
          .eq("azienda_id", contesto.azienda_id)
          .order("data_visita", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    if ((odInvariato || osInvariato) && !precedente) {
      return { errore: "Non esiste una prescrizione precedente da cui recuperare l'occhio invariato." };
    }

    // Decisione Fable/fermata 3: il campo legacy resta leggibile, ma non guida
    // più le nuove superfici. Plano è un valore della sezione Occhiali.
    const tipoLegacy = haOcchiali ? "occhiali" : "lac";
    const { data: prescrizione, error: erroreRx } = await supabase
      .from("prescrizioni")
      .insert({
        azienda_id: contesto.azienda_id,
        cliente_id: clienteId,
        tipo: tipoLegacy,
        data_visita: dataVisita,
        utente_id: origineRaw === "check_up" || origineRaw === "lenti_cliente" ? contesto.utente_id : null,
        origine: origineRaw,
        esaminatore: null,
        uso: haOcchiali ? tipologia : null,
        ha_occhiali: haOcchiali,
        ha_lac: haLac,
        plano,
        data_scadenza: dataScadenza,
        scadenza_modificata: scadenzaModificata,
        oculista_id: oculistaId,
        derivata_da: rettificaNatura === "clinica" ? rettificaDi : null,
        tipologia_od: tipologia === "mista" ? tipologiaOd : null,
        tipologia_os: tipologia === "mista" ? tipologiaOs : null,
        od_sfero: haOcchiali ? (odInvariato ? precedente!.od_sfero : numero(formData, "od_sfero")) : null,
        od_cilindro: haOcchiali ? (odInvariato ? precedente!.od_cilindro : numero(formData, "od_cilindro")) : null,
        od_asse: haOcchiali ? (odInvariato ? precedente!.od_asse : odAsse) : null,
        os_sfero: haOcchiali ? (osInvariato ? precedente!.os_sfero : numero(formData, "os_sfero")) : null,
        os_cilindro: haOcchiali ? (osInvariato ? precedente!.os_cilindro : numero(formData, "os_cilindro")) : null,
        os_asse: haOcchiali ? (osInvariato ? precedente!.os_asse : osAsse) : null,
        addizione: haOcchiali ? (odInvariato ? precedente!.od_add : numero(formData, "od_add")) : null,
        od_add: haOcchiali ? (odInvariato ? precedente!.od_add : numero(formData, "od_add")) : null,
        os_add: haOcchiali ? (osInvariato ? precedente!.os_add : numero(formData, "os_add")) : null,
        od_visus: haOcchiali ? (odInvariato ? precedente!.od_visus : testo(formData, "od_visus")) : null,
        os_visus: haOcchiali ? (osInvariato ? precedente!.os_visus : testo(formData, "os_visus")) : null,
        od_prisma: haOcchiali ? odPrisma : null,
        od_prisma_base: haOcchiali ? odPrismaBase as PrismaBase | null : null,
        os_prisma: haOcchiali ? osPrisma : null,
        os_prisma_base: haOcchiali ? osPrismaBase as PrismaBase | null : null,
        notazione: haOcchiali ? testo(formData, "notazione") as "tabo" | "internazionale" | null : null,
        speciali,
        speciali_note: testo(formData, "speciali_note"),
        od_invariato: odInvariato,
        os_invariato: osInvariato,
        appaiamento: checkbox(formData, "appaiamento"),
        // DNP resta legacy e non viene più raccolta sulla prescrizione (M2/M4).
        validita_mesi: validitaMesi,
        note: testo(formData, "note"),
      })
      .select("id")
      .single();
    if (erroreRx || !prescrizione) return { errore: `Prescrizione non salvata: ${erroreRx?.message ?? "risposta vuota"}` };

    // Il consenso sanitario è un FATTO per-Rx nel mastro B1, non una cache su
    // clienti. La sua presenza è stata validata prima della scrittura clinica.
    const { error: erroreConsenso } = await supabase.rpc("registra_consenso", {
      p_cliente_id: clienteId,
      p_tipo: "dati_sanitari",
      p_azione: "dato",
      p_canali: null,
      p_modalita: (testo(formData, "modalita_consenso") ?? "digitale") as "penna" | "digitale",
      p_prescrizione_id: prescrizione.id,
      p_versione: null,
      p_documento_ref: null,
    });
    if (erroreConsenso) {
      await supabase.from("prescrizioni").delete().eq("id", prescrizione.id);
      return { errore: `Consenso non registrato: ${erroreConsenso.message}` };
    }

    if (haLac) {
      const righe = (["od", "os"] as const).flatMap((occhio) => {
        if (!checkbox(formData, `lac_${occhio}_attiva`)) return [];
        const tipologiaLac = testo(formData, `lac_${occhio}_tipologia`);
        const visus = testo(formData, `lac_${occhio}_visus`);
        if (!tipologiaLac || !TIPOLOGIE_LAC.has(tipologiaLac) || !visus) return [];
        const sottotipo = testo(formData, `lac_${occhio}_sottotipo`);
        const geometria = testo(formData, `lac_${occhio}_geometria`);
        return [{
          azienda_id: contesto.azienda_id,
          prescrizione_id: prescrizione.id,
          occhio,
          tipologia: tipologiaLac as "monofocale" | "multifocale" | "rigida" | "semirigida" | "specialistica",
          sottotipo: sottotipo && SOTTOTIPI_LAC.has(sottotipo) ? sottotipo : null,
          geometria: geometria && GEOMETRIE_LAC.has(geometria) ? geometria : null,
          fornitore: testo(formData, `lac_${occhio}_fornitore`),
          modello: testo(formData, `lac_${occhio}_modello`),
          prodotto_id: testo(formData, `lac_${occhio}_prodotto_id`),
          sfero: numero(formData, `lac_${occhio}_sfero`),
          cilindro: numero(formData, `lac_${occhio}_cilindro`),
          asse: numero(formData, `lac_${occhio}_asse`),
          addizione: numero(formData, `lac_${occhio}_addizione`),
          bc: numero(formData, `lac_${occhio}_bc`),
          dia: numero(formData, `lac_${occhio}_dia`),
          extra: {},
          visus,
          dominante: checkbox(formData, `lac_${occhio}_dominante`),
          note: testo(formData, `lac_${occhio}_note`),
        }];
      });
      if (righe.length === 0) {
        await supabase.from("prescrizioni").delete().eq("id", prescrizione.id);
        return { errore: "Attiva e compila almeno un occhio LAC definitivo, incluso il visus corretto." };
      }
      const { error: erroreLac } = await supabase.from("prescrizioni_lac").insert(righe);
      if (erroreLac) {
        await supabase.from("prescrizioni").delete().eq("id", prescrizione.id);
        return { errore: `LAC definitiva non salvata: ${erroreLac.message}` };
      }
    }

    if (rettificaDi && rettificaNatura === "digitazione") {
      const { error: erroreSostituzione } = await supabase
        .from("prescrizioni")
        .delete()
        .eq("id", rettificaDi)
        .eq("cliente_id", clienteId)
        .eq("azienda_id", contesto.azienda_id);
      if (erroreSostituzione) return { errore: `La prescrizione corretta è salvata, ma la sostituzione non è riuscita: ${erroreSostituzione.message}` };
    }

    revalidatePath(`/clienti/${clienteId}`);
    const creaOrdine = formData.get("azione_post_salvataggio") === "crea_ordine";
    destinazione = creaOrdine ? `/ordini?prescrizione_id=${prescrizione.id}&ponte=b2` : `/clienti/${clienteId}`;
  } catch (errore) {
    return esitoDaErrore(errore);
  }
  redirect(destinazione!);
}
