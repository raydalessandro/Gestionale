import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaProdotto, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2.3 · Trigger giacenza — la cache `prodotti.giacenza` la muove SOLO il
 * trigger sui movimenti (append-only). Qui si verifica il calcolo; che il
 * CODICE non tocchi giacenza a mano lo garantisce la guardia L4.
 */
describe.skipIf(!haEnv())("Magazzino · trigger giacenza", () => {
  let T: Tenant;
  let prodotto: string;

  beforeAll(async () => {
    T = await creaTenant("mag");
    prodotto = await creaProdotto(T);
  });
  afterAll(pulisci);

  async function giacenza(): Promise<number> {
    const { data } = await T.cli.from("prodotti").select("giacenza").eq("id", prodotto).single();
    return data!.giacenza as number;
  }

  it("carico +10 poi uso interno −4 → giacenza 6", async () => {
    const { error: e1 } = await T.cli.from("movimenti_magazzino").insert({
      azienda_id: T.aziendaId,
      prodotto_id: prodotto,
      tipo: "carico",
      quantita: 10,
      riferimento: "Bolla test",
    });
    expect(e1).toBeNull();
    expect(await giacenza()).toBe(10);

    const { error: e2 } = await T.cli.from("movimenti_magazzino").insert({
      azienda_id: T.aziendaId,
      prodotto_id: prodotto,
      tipo: "uso_interno",
      quantita: -4,
    });
    expect(e2).toBeNull();
    expect(await giacenza()).toBe(6);
  });

  it("una rettifica ± sposta la giacenza del suo segno", async () => {
    const prima = await giacenza();
    await T.cli.from("movimenti_magazzino").insert({
      azienda_id: T.aziendaId,
      prodotto_id: prodotto,
      tipo: "rettifica",
      quantita: -1,
      note: "conteggio",
    });
    expect(await giacenza()).toBe(prima - 1);
  });
});
