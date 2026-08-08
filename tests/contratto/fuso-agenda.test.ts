import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istanteRomaISO } from "@/lib/utils";
import {
  creaTenant,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — SENTINELLA DEL FUSO (TODO-ray §6, migrazione 019).
 *
 * L'invariante che G8 rende critico: un appuntamento «10:00» preso AL BANCO e una
 * richiesta «10:00» dal PORTALE, lo stesso giorno, devono cadere sullo STESSO
 * istante assoluto — altrimenti convivono nella stessa agenda mostrando ore
 * diverse, o non si contendono lo slot che invece è lo stesso.
 *
 * Il banco costruisce l'istante con `istanteRomaISO(giorno,"10:00")` (ancorato a
 * Europe/Rome); il portale lo prende da `slot_liberi`, anch'esso ancorato a Roma.
 * La prova, collision-free e definitiva: un appuntamento da banco messo su
 * `istanteRomaISO(giorno,"10:00")` CONSUMA esattamente lo slot che il portale
 * offriva per le 10:00 (sparisce da `slot_liberi`), e una `crea_prenotazione`
 * sulle stesse 10:00 collide (`SLOT_OCCUPATO`). Se il fuso del banco divergesse
 * (naïve-UTC → mezzogiorno a Roma), il banco occuperebbe un ALTRO istante e lo
 * slot delle 10:00 resterebbe libero: questa sentinella diventerebbe rossa.
 *
 * Gira sul progetto di test come gli altri contract (skip pulito senza env).
 */

const TZ = "Europe/Rome";
function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
function piuGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(d);
}

/** Ora di parete italiana (HH:MM) da un istante ISO — come la legge l'agenda. */
function oraRoma(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

let telSeq = 0;
const TEL_BASE = String(Date.now()).slice(-7);
function telefonoUnico(): string {
  return `3${TEL_BASE}${String(telSeq++).padStart(2, "0")}`; // 10 cifre, base=ms avvio: unica tra run e suite
}

describe.skipIf(!haEnv())("019 · fuso — banco e portale sullo stesso istante (G8)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let neg: Tenant;

  async function slot(giorno: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_giorno: giorno,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    neg = await creaTenant("g8fuso");
    await svc
      .from("aziende")
      .update({ portale_attivo: true, nome_pubblico: `Ottica Fuso ${RUN_ID}` })
      .eq("id", neg.aziendaId);

    const orari = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
      azienda_id: neg.aziendaId,
      giorno: g,
      apre: "09:00",
      chiude: "17:00",
    }));
    const eO = await svc.from("orari_apertura").insert(orari);
    if (eO.error) throw new Error(`seed orari: ${eO.error.message}`);
    const eS = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: neg.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (eS.error) throw new Error(`seed servizio: ${eS.error.message}`);
  });

  afterAll(async () => {
    if (!haEnv()) return;
    await svc.from("lista_attesa").delete().eq("azienda_id", neg?.aziendaId);
    const { data: prens } = await svc
      .from("prenotazioni")
      .select("appuntamento_id")
      .eq("azienda_id", neg.aziendaId);
    const collegati = (prens ?? [])
      .map((p) => p.appuntamento_id as string | null)
      .filter((x): x is string => Boolean(x));
    let q = svc.from("appuntamenti").delete().eq("azienda_id", neg.aziendaId);
    if (collegati.length) q = q.not("id", "in", `(${collegati.join(",")})`);
    await q;
    await pulisci().catch(() => undefined);
  });

  it("un appuntamento banco «10:00» (istanteRomaISO) occupa lo stesso slot che il portale offre alle 10:00", async () => {
    const giorno = piuGiorni(oggiRomaISO(), 12);
    const target = istanteRomaISO(giorno, "10:00"); // così lo costruisce il BANCO

    // 1) il portale OFFRE precisamente quell'istante per le 10:00 di Roma.
    const prima = await slot(giorno);
    const match = prima.find((s) => new Date(s).getTime() === new Date(target).getTime());
    expect(match, "slot_liberi deve offrire l'istante delle 10:00 di Roma (== istanteRomaISO)").toBeTruthy();
    // e quell'istante, riletto a Roma, sono davvero le 10:00 (non mezzogiorno).
    expect(oraRoma(target)).toBe("10:00");

    // 2) il BANCO inserisce l'appuntamento su quell'istante (come creaAppuntamento).
    const { data: appt, error: eIns } = await svc
      .from("appuntamenti")
      .insert({
        azienda_id: neg.aziendaId,
        utente_id: neg.userId,
        tipo: "controllo_vista",
        inizio: target,
        durata_minuti: 30,
        stato: "prenotato",
        fonte: "banco",
        note: "banco-fuso",
      })
      .select("inizio")
      .single();
    expect(eIns, eIns?.message).toBeFalsy();
    expect(new Date(appt!.inizio).getTime(), "l'istante è memorizzato verbatim").toBe(
      new Date(target).getTime()
    );

    // 3) la prova: lo slot delle 10:00 del PORTALE ora è sparito (stesso istante!).
    const dopo = await slot(giorno);
    expect(
      dopo.some((s) => new Date(s).getTime() === new Date(target).getTime()),
      "il banco delle 10:00 consuma esattamente lo slot delle 10:00 del portale"
    ).toBe(false);

    // 4) end-to-end: una richiesta dal portale sulle stesse 10:00 collide.
    const { error: ePren } = await anon.rpc("crea_prenotazione", {
      p_slug: neg.slug,
      p_servizio: "visita",
      p_inizio: target,
      p_nome: "Prova Fuso",
      p_telefono: telefonoUnico(),
      p_email: "",
      p_per_conto_di: "",
      p_note: "",
      p_fonte: "qr_vetrina",
      p_chiave_richiesta: `fuso-${RUN_ID}-${target}`,
      p_lista_attesa: false,
    });
    expect(ePren, "il portale sulle stesse 10:00 del banco deve fallire").toBeTruthy();
    expect(ePren!.message, "portale e banco si contendono lo STESSO istante delle 10:00").toContain(
      "SLOT_OCCUPATO"
    );
  });
});
