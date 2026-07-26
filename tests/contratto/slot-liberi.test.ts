import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  creaTenant,
  serviceClient,
  anonClient,
  pulisci,
  haEnv,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — Migrazione 011 (G6 · l'ALGORITMO di slot_liberi).
 *
 * SCELTA ARCHITETTURALE (documentata anche nel report): l'algoritmo degli slot
 * vive in SQL (`slot_liberi`, security definer), perché solo una funzione
 * definer legge appuntamenti/prenotazioni/blocchi che all'anon sono revocati.
 * Quindi questi casi NON possono essere unit puri L1: si esercitano come test di
 * CONTRATTO che seminano lo scenario col service role e chiamano la rpc dall'anon.
 *
 * Trucco anti-fuso: per gli scenari con appuntamenti/blocchi NON si costruiscono
 * timestamp a mano (rischio errori di offset CET/CEST). Si chiede prima a
 * slot_liberi la lista dei candidati liberi (istanti ASSOLUTI, già corretti),
 * poi si semina l'ostacolo su uno di quegli istanti e si riconta. Robusto per
 * costruzione, indipendente dall'ora legale.
 *
 * Costanti della funzione (011): passo 15', anticipo 2h, orizzonte 90gg, fuso
 * Europe/Rome. Le date di prova sono sempre giorni FUTURI (oltre l'anticipo, entro
 * l'orizzonte), così l'anticipo non intacca i conteggi salvo il caso dedicato.
 */

const TZ = "Europe/Rome";
const QUARTO = 15 * 60 * 1000; // 15' in ms

function oggiRomaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function piuGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function dow(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}
/** Prima data >= oggi+minOffset con un certo giorno-settimana. */
function futuroPerDow(target: number, minOffset: number): string {
  let iso = piuGiorni(oggiRomaISO(), minOffset);
  while (dow(iso) !== target) iso = piuGiorni(iso, 1);
  return iso;
}
/** Ora di parete a Roma di un istante ISO → "HH:MM". */
function romeHM(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
/** Minuti dalla mezzanotte (ora di Roma) di un istante ISO. */
function romeMin(iso: string): number {
  const [h, m] = romeHM(iso).split(":").map(Number);
  return h * 60 + m;
}
/** Ultima domenica del mese (month1: 1-12) come data ISO. */
function ultimaDomenica(anno: number, month1: number): string {
  const ultimo = new Date(Date.UTC(anno, month1, 0)); // giorno 0 del mese dopo = ultimo giorno
  const giorno = ultimo.getUTCDate() - ultimo.getUTCDay();
  return `${anno}-${String(month1).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

describe.skipIf(!haEnv())("011 · slot_liberi — l'algoritmo", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let alg: Tenant; // scenari deterministici su giorni futuri
  let ant: Tenant; // anticipo minimo (oggi, fascia tutto il giorno)
  let dst: Tenant; // cambio dell'ora legale

  // Giorni futuri, distinti per dow così gli orari non si sovrappongono.
  const mondays: string[] = [];
  let tuesday = "";
  let wednesday = "";
  let oggi = "";
  let targetDomenica = ""; // giorno di prova per il DST
  let dstNelloOrizzonte = false;

  async function slot(slug: string, servizio: string, giorno: string): Promise<string[]> {
    const { data, error } = await anon.rpc("slot_liberi", {
      p_slug: slug,
      p_servizio: servizio,
      p_giorno: giorno,
    });
    if (error) throw new Error(`slot_liberi: ${error.message}`);
    return (data as string[]) ?? [];
  }

  beforeAll(async () => {
    svc = serviceClient();
    anon = anonClient();
    alg = await creaTenant("slgalg");
    ant = await creaTenant("slgant");
    dst = await creaTenant("slgdst");
    for (const t of [alg, ant, dst]) {
      await svc.from("aziende").update({ portale_attivo: true }).eq("id", t.aziendaId);
    }

    oggi = oggiRomaISO();

    // 4 lunedì futuri consecutivi (offset 7..28, tutti entro l'orizzonte).
    let iso = piuGiorni(oggi, 7);
    while (mondays.length < 4) {
      if (dow(iso) === 1) mondays.push(iso);
      iso = piuGiorni(iso, 1);
    }
    tuesday = futuroPerDow(2, 7);
    wednesday = futuroPerDow(3, 7); // dow SENZA orari → giorno chiuso

    // ── ALG · orari: lunedì fascia unica 09–13; martedì due fasce con pausa ──
    const orariAlg = await svc.from("orari_apertura").insert([
      { azienda_id: alg.aziendaId, giorno: 1, apre: "09:00", chiude: "13:00" },
      { azienda_id: alg.aziendaId, giorno: 2, apre: "09:00", chiude: "13:00" },
      { azienda_id: alg.aziendaId, giorno: 2, apre: "15:00", chiude: "19:00" },
    ]);
    if (orariAlg.error) throw new Error(`orari alg: ${orariAlg.error.message}`);

    // Servizi con durata forzata (deroga): 30', 60', 15' per pilotare i conteggi.
    const servAlg = await svc.from("negozi_servizi").insert([
      { azienda_id: alg.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true },
      { azienda_id: alg.aziendaId, servizio_codice: "occhiale", durata_minuti: 60, attivo: true },
      { azienda_id: alg.aziendaId, servizio_codice: "controllo", durata_minuti: 15, attivo: true },
    ]);
    if (servAlg.error) throw new Error(`servizi alg: ${servAlg.error.message}`);

    // Chiusura per ferie che copre il 4° lunedì (M4).
    const chi = await svc.from("chiusure").insert({
      azienda_id: alg.aziendaId,
      dal: mondays[3],
      al: mondays[3],
      motivo: "Ferie di prova",
    });
    if (chi.error) throw new Error(`chiusura alg: ${chi.error.message}`);

    // ── ANT · fascia di tutto il giorno OGGI, per esercitare l'anticipo 2h ──
    const orariAnt = await svc
      .from("orari_apertura")
      .insert({ azienda_id: ant.aziendaId, giorno: dow(oggi), apre: "00:00", chiude: "23:45" });
    if (orariAnt.error) throw new Error(`orari ant: ${orariAnt.error.message}`);
    const servAnt = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: ant.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (servAnt.error) throw new Error(`servizio ant: ${servAnt.error.message}`);

    // ── DST · giorno del cambio dell'ora legale, se entro l'orizzonte 90gg ──
    const anno = Number(oggi.slice(0, 4));
    const cambi = [
      ultimaDomenica(anno, 3),
      ultimaDomenica(anno, 10),
      ultimaDomenica(anno + 1, 3),
      ultimaDomenica(anno + 1, 10),
    ]
      .filter((d) => d > oggi)
      .sort();
    const prossimoCambio = cambi[0];
    dstNelloOrizzonte = prossimoCambio <= piuGiorni(oggi, 90);
    // Se il cambio è dentro l'orizzonte lo si usa; altrimenti si valida comunque
    // l'invarianza degli orari di parete su una domenica futura qualsiasi.
    targetDomenica = dstNelloOrizzonte ? prossimoCambio : futuroPerDow(0, 1);

    const orariDst = await svc
      .from("orari_apertura")
      .insert({ azienda_id: dst.aziendaId, giorno: 0, apre: "09:00", chiude: "13:00" });
    if (orariDst.error) throw new Error(`orari dst: ${orariDst.error.message}`);
    const servDst = await svc
      .from("negozi_servizi")
      .insert({ azienda_id: dst.aziendaId, servizio_codice: "visita", durata_minuti: 30, attivo: true });
    if (servDst.error) throw new Error(`servizio dst: ${servDst.error.message}`);
  });
  afterAll(pulisci);

  // ── giorno chiuso (nessun orario quel giorno della settimana) ──────────────
  it("giorno senza orari configurati → nessuno slot", async () => {
    const s = await slot(alg.slug, "visita", wednesday);
    expect(s.length).toBe(0);
  });

  // ── giorno dentro una chiusura per ferie ───────────────────────────────────
  it("giorno dentro una chiusura per ferie → nessuno slot", async () => {
    const s = await slot(alg.slug, "visita", mondays[3]);
    expect(s.length).toBe(0);
  });

  // ── fascia unica 09–13, servizio 30' → 15 slot (09:00 … 12:30) ─────────────
  it("fascia unica 09–13 con servizio 30' → 15 slot, dal 09:00 al 12:30", async () => {
    const s = await slot(alg.slug, "visita", mondays[0]);
    expect(s.length).toBe(15);
    expect(romeHM(s[0])).toBe("09:00");
    expect(romeHM(s[s.length - 1])).toBe("12:30");
    // passo di 15' esatto fra candidati consecutivi
    for (let i = 1; i < s.length; i++) {
      expect(new Date(s[i]).getTime() - new Date(s[i - 1]).getTime()).toBe(QUARTO);
    }
  });

  // ── due fasce con pausa pranzo → 15 + 15 = 30 slot, pausa vuota ────────────
  it("due fasce (09–13, 15–19) con servizio 30' → 30 slot e pausa pranzo vuota", async () => {
    const s = await slot(alg.slug, "visita", tuesday);
    expect(s.length).toBe(30);
    const nellaPausa = s.filter((x) => romeMin(x) >= 13 * 60 && romeMin(x) < 15 * 60);
    expect(nellaPausa.length, "fra 13:00 e 15:00 non ci sono slot").toBe(0);
  });

  // ── servizio 60' a fine giornata: l'ultimo inizio + 60' non sfora ─────────
  it("servizio 60' a fine giornata: l'ultimo inizio + 60' non supera la chiusura", async () => {
    const s = await slot(alg.slug, "occhiale", mondays[0]);
    // 09:00 … 12:00 (12:00 + 60' = 13:00): 13 slot.
    expect(s.length).toBe(13);
    const ultimo = romeMin(s[s.length - 1]);
    expect(ultimo).toBe(12 * 60); // 12:00
    expect(ultimo + 60, "l'ultimo slot + durata non sfora la chiusura").toBeLessThanOrEqual(13 * 60);
  });

  // ── appuntamento 'prenotato' toglie gli slot sovrapposti; 'annullato' no ───
  it("un appuntamento 'prenotato' rimuove gli slot sovrapposti; un 'annullato' NO", async () => {
    const base = await slot(alg.slug, "visita", mondays[1]);
    expect(base.length, "M2 parte pulito").toBe(15);
    const k = 5; // slot centrale: i vicini k-1 e k+1 esistono

    // 'annullato' sul primo slot: NON deve bloccare nulla.
    const ann = await svc.from("appuntamenti").insert({
      azienda_id: alg.aziendaId,
      utente_id: alg.userId,
      tipo: "controllo_vista",
      inizio: base[0],
      durata_minuti: 30,
      stato: "annullato",
    });
    expect(ann.error, "un appuntamento annullato è fuori dal calcolo").toBeFalsy();

    // 'prenotato' esattamente su base[k]: 30' a passo 15' → toglie k-1, k, k+1.
    const pre = await svc.from("appuntamenti").insert({
      azienda_id: alg.aziendaId,
      utente_id: alg.userId,
      tipo: "controllo_vista",
      inizio: base[k],
      durata_minuti: 30,
      stato: "prenotato",
    });
    expect(pre.error).toBeFalsy();

    const dopo = await slot(alg.slug, "visita", mondays[1]);
    expect(dopo).not.toContain(base[k - 1]);
    expect(dopo).not.toContain(base[k]);
    expect(dopo).not.toContain(base[k + 1]);
    expect(dopo, "l'annullato non ha tolto il primo slot").toContain(base[0]);
    expect(dopo.length).toBe(12);
  });

  // ── blocco_slot a cavallo di due candidati → li rimuove entrambi ──────────
  it("un blocco a cavallo di due candidati li rimuove entrambi", async () => {
    const base = await slot(alg.slug, "controllo", mondays[2]);
    // servizio 15' su 09–13 → candidati contigui non sovrapposti: 09:00 … 12:45.
    expect(base.length).toBe(16);
    const k = 5;
    expect(new Date(base[k + 1]).getTime() - new Date(base[k]).getTime()).toBe(QUARTO);

    // blocco da +5' a +20' rispetto a base[k]: cade a cavallo di base[k] e base[k+1].
    const inizio = new Date(new Date(base[k]).getTime() + 5 * 60 * 1000).toISOString();
    const fine = new Date(new Date(base[k]).getTime() + 20 * 60 * 1000).toISOString();
    const b = await svc.from("blocchi_slot").insert({ azienda_id: alg.aziendaId, inizio, fine });
    expect(b.error).toBeFalsy();

    const dopo = await slot(alg.slug, "controllo", mondays[2]);
    expect(dopo).not.toContain(base[k]);
    expect(dopo).not.toContain(base[k + 1]);
    expect(dopo, "i candidati adiacenti al blocco restano").toContain(base[k - 1]);
    expect(dopo).toContain(base[k + 2]);
    expect(dopo.length).toBe(14);
  });

  // ── anticipo minimo: niente slot a meno di 2h da adesso ───────────────────
  it("anticipo minimo: nessuno slot cade a meno di 2 ore da adesso", async () => {
    const s = await slot(ant.slug, "visita", oggi);
    const adesso = Date.now();
    const dueOre = 2 * 60 * 60 * 1000;
    for (const x of s) {
      // tolleranza di 2s per il tempo trascorso fra la rpc e questo confronto
      expect(new Date(x).getTime(), `slot ${romeHM(x)} è dentro l'anticipo`).toBeGreaterThanOrEqual(
        adesso + dueOre - 2000
      );
    }
    // Se la giornata ha ancora spazio dopo la finestra di anticipo, DEVE esserci
    // almeno uno slot; se è già sera tardi lo si documenta e non si pretende.
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
    const [h, m] = hm.split(":").map(Number);
    const nowMin = h * 60 + m;
    const cSpazio = nowMin + 120 + 30 <= 23 * 60 + 45; // uno slot 30' entra dopo l'anticipo
    if (cSpazio) {
      expect(s.length, "dopo la finestra di anticipo restano slot").toBeGreaterThan(0);
    }
  });

  // ── giorno del cambio dell'ora legale: candidati di parete validi ─────────
  it("giorno del cambio dell'ora legale: candidati validi (multipli di 15', dentro la fascia)", async () => {
    // dstNelloOrizzonte segnala se il giorno di prova è davvero un cambio DST
    // (entro 90gg) o una domenica normale di ripiego — dettaglio nel report.
    const s = await slot(dst.slug, "visita", targetDomenica);
    // La fascia 09–13 sta interamente DOPO la transizione (02:00/03:00): il
    // conteggio resta nominale, ma resta un buon oracolo di validità di parete.
    expect(s.length).toBe(15);
    expect(romeHM(s[0])).toBe("09:00");
    expect(romeHM(s[s.length - 1])).toBe("12:30");
    for (const x of s) {
      const min = romeMin(x);
      expect(min % 15, "ogni candidato è un multiplo di 15' di parete").toBe(0);
      expect(min).toBeGreaterThanOrEqual(9 * 60);
      expect(min + 30, "inizio + durata dentro la fascia").toBeLessThanOrEqual(13 * 60);
    }
    // Passo di 15' in tempo ASSOLUTO: l'ancoraggio at-time-zone non deve creare
    // né saltare candidati nel giorno del cambio d'ora.
    for (let i = 1; i < s.length; i++) {
      expect(new Date(s[i]).getTime() - new Date(s[i - 1]).getTime()).toBe(QUARTO);
    }
  });
});
