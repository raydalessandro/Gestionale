import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaProdotto, creaCliente, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2.4 · Vincoli del contratto — il DB rifiuta i dati incoerenti, sempre,
 * indipendentemente dalla UI. Segno/tipo movimenti, asse, stati, unicità.
 */
describe.skipIf(!haEnv())("Vincoli DB", () => {
  let T: Tenant;
  let prodotto: string;
  let cliente: string;

  beforeAll(async () => {
    T = await creaTenant("vin");
    prodotto = await creaProdotto(T);
    cliente = await creaCliente(T);
  });
  afterAll(pulisci);

  it("movimento 'carico' con quantità negativa → rifiutato (segno coerente)", async () => {
    const { error } = await T.cli.from("movimenti_magazzino").insert({
      azienda_id: T.aziendaId,
      prodotto_id: prodotto,
      tipo: "carico",
      quantita: -5,
    });
    expect(error).not.toBeNull();
  });

  it("movimento 'rettifica' con quantità 0 → rifiutato (quantita <> 0)", async () => {
    const { error } = await T.cli.from("movimenti_magazzino").insert({
      azienda_id: T.aziendaId,
      prodotto_id: prodotto,
      tipo: "rettifica",
      quantita: 0,
    });
    expect(error).not.toBeNull();
  });

  it("stato ordine fuori lista → rifiutato (check enum)", async () => {
    const { error } = await T.cli.from("ordini_lac").insert({
      azienda_id: T.aziendaId,
      cliente_id: cliente,
      numero: `TEST-STATO-${Date.now()}`,
      stato: "in_orbita",
    });
    expect(error).not.toBeNull();
  });

  it("asse 181 → rifiutato (check 0–180)", async () => {
    const { error } = await T.cli.from("prescrizioni").insert({
      azienda_id: T.aziendaId,
      cliente_id: cliente,
      tipo: "occhiali",
      od_asse: 181,
    });
    expect(error).not.toBeNull();
  });

  it("asse 180 → accettato (bordo valido)", async () => {
    const { error } = await T.cli.from("prescrizioni").insert({
      azienda_id: T.aziendaId,
      cliente_id: cliente,
      tipo: "occhiali",
      od_asse: 180,
    });
    expect(error).toBeNull();
  });

  it("numero ordine duplicato nella stessa azienda → 23505 (unique)", async () => {
    const numero = `TEST-DUP-${Date.now()}`;
    const primo = await T.cli
      .from("ordini_lac")
      .insert({ azienda_id: T.aziendaId, cliente_id: cliente, numero });
    expect(primo.error).toBeNull();

    const secondo = await T.cli
      .from("ordini_lac")
      .insert({ azienda_id: T.aziendaId, cliente_id: cliente, numero });
    expect(secondo.error?.code).toBe("23505");
  });
});
