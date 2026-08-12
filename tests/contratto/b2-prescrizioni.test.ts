import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonClient,
  creaCliente,
  creaProdotto,
  creaTenant,
  haEnv,
  pulisci,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto B2 — 024 prescrizioni.
 *
 * RV-01 esige tre asserzioni per ogni vincolo allargato: il dominio legacy
 * rimane valido, il nuovo valore M2 passa, il fuori-dominio è respinto. La
 * suite usa esclusivamente i segreti TEST tramite _helpers.
 */
describe.skipIf(!haEnv())("024 · B2 prescrizioni · domini, LAC e tenant", () => {
  let A: Tenant;
  let B: Tenant;
  let anon: SupabaseClient;
  let clienteA: string;
  let clienteB: string;
  let prodottoB: string;

  async function rxA(extra: Record<string, unknown> = {}) {
    const { data, error } = await A.cli
      .from("prescrizioni")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteA,
        tipo: "occhiali",
        origine: "check_up",
        ha_occhiali: true,
        data_scadenza: "2027-08-12",
        ...extra,
      })
      .select("id")
      .single();
    expect(error, "il seed Rx A deve riuscire").toBeNull();
    return data!.id as string;
  }

  beforeAll(async () => {
    [A, B] = await Promise.all([creaTenant("b2a"), creaTenant("b2b")]);
    [clienteA, clienteB, prodottoB] = await Promise.all([
      creaCliente(A, { cognome: `A ${RUN_ID}` }),
      creaCliente(B, { cognome: `B ${RUN_ID}` }),
      creaProdotto(B),
    ]);
    anon = anonClient();
  });
  afterAll(pulisci);

  it("RV-01 origine: legacy, nuovo M2 e fuori-dominio", async () => {
    const legacy = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", origine: "interna",
    });
    expect(legacy.error, "origine legacy interna resta valida").toBeNull();

    const nuovo = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", origine: "ricetta_oculistica",
    });
    expect(nuovo.error, "origine M2 ricetta_oculistica passa").toBeNull();

    const fuori = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", origine: "inventata",
    });
    expect(fuori.error).not.toBeNull();
    expect(fuori.error!.code).toBe("23514");
  });

  it("RV-01 tipologia e base prisma: dominio legacy, M2 e fuori-dominio", async () => {
    const legacy = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", uso: "progressivo", od_prisma: 1, od_prisma_base: "alto",
    });
    expect(legacy.error, "progressivo e alto legacy restano validi").toBeNull();

    const nuovo = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", uso: "progressiva", od_prisma: 1, od_prisma_base: "interna",
    });
    expect(nuovo.error, "progressiva e interna M2 passano").toBeNull();

    const fuori = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", uso: "astrale",
    });
    expect(fuori.error).not.toBeNull();
    expect(fuori.error!.code).toBe("23514");
  });

  it("M2 prisma: valore e base devono viaggiare insieme", async () => {
    const soloValore = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", od_prisma: 1,
    });
    expect(soloValore.error).not.toBeNull();
    expect(soloValore.error!.code).toBe("23514");

    const solaBase = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", os_prisma_base: "esterna",
    });
    expect(solaBase.error).not.toBeNull();
    expect(solaBase.error!.code).toBe("23514");

    const coppia = await A.cli.from("prescrizioni").insert({
      azienda_id: A.aziendaId, cliente_id: clienteA, tipo: "occhiali", od_prisma: 1, od_prisma_base: "interna",
    });
    expect(coppia.error, "prisma con la sua base passa").toBeNull();
  });

  it("LAC definitiva: una sola riga per occhio e visus obbligatorio", async () => {
    const rx = await rxA({ ha_lac: true });
    const prima = await A.cli.from("prescrizioni_lac").insert({
      azienda_id: A.aziendaId, prescrizione_id: rx, occhio: "od", tipologia: "monofocale", visus: "10/10",
    });
    expect(prima.error).toBeNull();

    const doppia = await A.cli.from("prescrizioni_lac").insert({
      azienda_id: A.aziendaId, prescrizione_id: rx, occhio: "od", tipologia: "monofocale", visus: "9/10",
    });
    expect(doppia.error).not.toBeNull();
    expect(doppia.error!.code).toBe("23505");

    const senzaVisus = await A.cli.from("prescrizioni_lac").insert({
      azienda_id: A.aziendaId, prescrizione_id: rx, occhio: "os", tipologia: "monofocale",
    });
    expect(senzaVisus.error).not.toBeNull();
    expect(senzaVisus.error!.code).toBe("23502");
  });

  it("tenant: LAC A che punta a prodotto B è 23514, mai FK nuda", async () => {
    const rx = await rxA({ ha_lac: true });
    const intrusa = await A.cli.from("prescrizioni_lac").insert({
      azienda_id: A.aziendaId,
      prescrizione_id: rx,
      prodotto_id: prodottoB,
      occhio: "od",
      tipologia: "monofocale",
      visus: "10/10",
    });
    expect(intrusa.error).not.toBeNull();
    expect(intrusa.error!.code).toBe("23514");
    expect(intrusa.error!.code).not.toBe("23503");
  });

  it("RLS: anon non legge né scrive prescrizioni_lac", async () => {
    const rx = await rxA({ ha_lac: true });
    const lettura = await anon.from("prescrizioni_lac").select("*").limit(1);
    expect(lettura.error, "anon non ha grant alla tabella clinica").toBeTruthy();
    expect(lettura.data ?? []).toEqual([]);

    const scrittura = await anon.from("prescrizioni_lac").insert({
      azienda_id: A.aziendaId, prescrizione_id: rx, occhio: "od", tipologia: "monofocale", visus: "10/10",
    });
    expect(scrittura.error).toBeTruthy();
  });

  it("RLS: A non legge la LAC definitiva della prescrizione B", async () => {
    const { data: rxB, error: rxBErrore } = await B.cli
      .from("prescrizioni")
      .insert({ azienda_id: B.aziendaId, cliente_id: clienteB, tipo: "lac", origine: "check_up", ha_lac: true })
      .select("id")
      .single();
    expect(rxBErrore).toBeNull();
    const { data: lacB, error: lacBErrore } = await B.cli
      .from("prescrizioni_lac")
      .insert({ azienda_id: B.aziendaId, prescrizione_id: rxB!.id, occhio: "od", tipologia: "monofocale", visus: "10/10" })
      .select("id")
      .single();
    expect(lacBErrore).toBeNull();

    const vistaDaA = await A.cli.from("prescrizioni_lac").select("id").eq("id", lacB!.id).maybeSingle();
    expect(vistaDaA.data).toBeNull();
  });
});
