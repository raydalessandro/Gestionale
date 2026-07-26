import { describe, it, expect, beforeEach } from "vitest";
import {
  controllaLimite,
  azzeraLimite,
  LIMITE_IP,
  LIMITE_TELEFONO,
} from "@/lib/ratelimit";

/**
 * L1 · Unit — lib/ratelimit.ts (ST-04, prima barriera anti-spam della prima
 * SCRITTURA del portale, G7). Funzione pura con `now` e `store` iniettabili:
 * si esercita senza rete e senza tempo reale.
 *
 * Contratto sotto esame:
 *  • IP: max 8 in 10' → il 9° tentativo dentro la finestra è respinto;
 *  • telefono: max 3 in 1h → il 4° è respinto;
 *  • le chiavi si controllano TUTTE prima di registrarne una qualsiasi: una
 *    chiave già bloccata NON consuma il budget dell'altra;
 *  • la finestra è scorrevole: avanzando `now` oltre la finestra il conto riparte;
 *  • `store` iniettato e `azzeraLimite()` isolano ogni caso.
 *
 * Le soglie si LEGGONO dalle costanti esportate (LIMITE_IP/LIMITE_TELEFONO), così
 * il test non ricopia i numeri: se qualcuno cambia una soglia senza ripensare la
 * difesa, è qui che se ne accorge — non a valle, nello spam vero.
 */

const IP = "203.0.113.7";
const TEL = "+393331234567";

describe("controllaLimite · limite IP (max 8 / 10')", () => {
  it("gli 8 tentativi entro la finestra passano e vengono registrati; il 9° è respinto", () => {
    const store = new Map<string, number[]>();
    const now = 1_000_000; // istante fisso: nessuna dipendenza dal tempo reale

    for (let i = 0; i < LIMITE_IP.max; i++) {
      const e = controllaLimite({ ip: IP }, now, store);
      expect(e.ok, `tentativo ${i + 1} dentro il budget deve passare`).toBe(true);
    }
    // i tentativi riusciti sono REGISTRATI: lo store porta gli 8 timbri.
    expect(store.get(`ip:${IP}`)?.length).toBe(LIMITE_IP.max);

    // il 9° dentro la stessa finestra scatta, indicando la chiave colpita.
    const nono = controllaLimite({ ip: IP }, now, store);
    expect(nono.ok).toBe(false);
    expect(nono.chiaveScattata).toBe(`ip:${IP}`);
    // un tentativo respinto NON viene registrato (resta a 8, non sale a 9).
    expect(store.get(`ip:${IP}`)?.length).toBe(LIMITE_IP.max);
  });

  it("oltre la finestra scorrevole il contatore riparte (avanzando `now`)", () => {
    const store = new Map<string, number[]>();
    const now = 5_000_000;
    for (let i = 0; i < LIMITE_IP.max; i++) controllaLimite({ ip: IP }, now, store);
    expect(controllaLimite({ ip: IP }, now, store).ok, "budget esaurito nella finestra").toBe(false);

    // appena fuori dalla finestra: i timbri vecchi non contano più.
    const dopo = now + LIMITE_IP.finestraMs + 1;
    const e = controllaLimite({ ip: IP }, dopo, store);
    expect(e.ok, "fuori finestra il conto riparte").toBe(true);
    // e nello store è rimasto solo il timbro nuovo (i vecchi sono stati potati).
    expect(store.get(`ip:${IP}`)?.length).toBe(1);
  });
});

describe("controllaLimite · limite telefono (max 3 / 1h)", () => {
  it("i 3 tentativi passano; il 4° entro l'ora è respinto sulla chiave telefono", () => {
    const store = new Map<string, number[]>();
    const now = 2_000_000;
    for (let i = 0; i < LIMITE_TELEFONO.max; i++) {
      expect(controllaLimite({ telefono: TEL }, now, store).ok).toBe(true);
    }
    const quarto = controllaLimite({ telefono: TEL }, now, store);
    expect(quarto.ok).toBe(false);
    expect(quarto.chiaveScattata).toBe(`tel:${TEL}`);
  });
});

describe("controllaLimite · le chiavi non si rubano il budget", () => {
  it("una chiave IP bloccata NON consuma il budget del telefono", () => {
    const store = new Map<string, number[]>();
    const now = 3_000_000;

    // saturo SOLO l'IP (senza telefono, così il suo budget resta intatto).
    for (let i = 0; i < LIMITE_IP.max; i++) controllaLimite({ ip: IP }, now, store);

    // richiesta con ENTRAMBE le chiavi: scatta sull'IP e ritorna PRIMA di
    // registrare il telefono (i controlli precedono le registrazioni).
    const e = controllaLimite({ ip: IP, telefono: TEL }, now, store);
    expect(e.ok).toBe(false);
    expect(e.chiaveScattata).toBe(`ip:${IP}`);
    expect(store.get(`tel:${TEL}`), "il telefono non è stato registrato").toBeUndefined();

    // prova: il telefono ha ancora tutto il suo budget (3 ok, poi il 4° scatta).
    for (let i = 0; i < LIMITE_TELEFONO.max; i++) {
      expect(controllaLimite({ telefono: TEL }, now, store).ok, `tel ${i + 1}`).toBe(true);
    }
    expect(controllaLimite({ telefono: TEL }, now, store).ok).toBe(false);
  });

  it("chiavi assenti (ip/telefono nulli) non impongono alcun limite", () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < 50; i++) {
      expect(controllaLimite({ ip: null, telefono: null }, 4_000_000, store).ok).toBe(true);
    }
    expect(store.size, "nessuna chiave registrata quando non c'è nulla da limitare").toBe(0);
  });
});

describe("isolamento dei test (store iniettato / azzeraLimite)", () => {
  beforeEach(() => azzeraLimite());

  it("due store iniettati distinti non si contaminano", () => {
    const a = new Map<string, number[]>();
    const b = new Map<string, number[]>();
    const now = 6_000_000;
    for (let i = 0; i < LIMITE_IP.max; i++) controllaLimite({ ip: IP }, now, a);
    expect(controllaLimite({ ip: IP }, now, a).ok, "store A saturo").toBe(false);
    expect(controllaLimite({ ip: IP }, now, b).ok, "store B è indipendente").toBe(true);
  });

  it("azzeraLimite() ripulisce lo store globale predefinito", () => {
    const now = 7_000_000;
    // uso lo store GLOBALE (nessun terzo argomento).
    for (let i = 0; i < LIMITE_IP.max; i++) controllaLimite({ ip: IP }, now);
    expect(controllaLimite({ ip: IP }, now).ok, "globale saturo").toBe(false);
    azzeraLimite();
    expect(controllaLimite({ ip: IP }, now).ok, "dopo l'azzeramento riparte").toBe(true);
  });
});
