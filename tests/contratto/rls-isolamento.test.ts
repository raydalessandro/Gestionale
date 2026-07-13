import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaCliente, creaProdotto, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2.1 · Isolamento RLS — il test che, da solo, vale il progetto.
 * Due aziende, due utenti: A non vede né tocca i dati di B.
 */
describe.skipIf(!haEnv())("RLS · isolamento fra aziende", () => {
  let A: Tenant;
  let B: Tenant;
  let clienteB: string;
  let prodottoB: string;

  beforeAll(async () => {
    [A, B] = await Promise.all([creaTenant("a"), creaTenant("b")]);
    clienteB = await creaCliente(B);
    prodottoB = await creaProdotto(B);
    await creaCliente(A); // A ha un suo cliente
  });

  afterAll(pulisci);

  it("A vede solo i propri clienti (i clienti di B sono invisibili)", async () => {
    const { data, error } = await A.cli.from("clienti").select("id, azienda_id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((c) => c.azienda_id === A.aziendaId)).toBe(true);
    expect((data ?? []).some((c) => c.id === clienteB)).toBe(false);
  });

  it("A non può leggere per id un cliente di B (RLS filtra: 0 righe)", async () => {
    const { data } = await A.cli.from("clienti").select("id").eq("id", clienteB).maybeSingle();
    expect(data).toBeNull();
  });

  it("A non può inserire un prodotto nell'azienda di B (with check nega)", async () => {
    const { error } = await A.cli
      .from("prodotti")
      .insert({ tipo: "lac", nome: "Intruso", prezzo: 1, azienda_id: B.aziendaId });
    expect(error).not.toBeNull();
  });

  it("A non può aggiornare un prodotto di B (update tocca 0 righe)", async () => {
    await A.cli.from("prodotti").update({ prezzo: 999 }).eq("id", prodottoB);
    // Verifica lato B: il prezzo è rimasto quello originale.
    const { data } = await B.cli.from("prodotti").select("prezzo").eq("id", prodottoB).single();
    expect(data?.prezzo).not.toBe(999);
  });

  it("i contatori non sono leggibili da nessun client (nessuna policy)", async () => {
    const { data } = await A.cli.from("contatori").select("*");
    expect(data ?? []).toEqual([]);
  });
});
