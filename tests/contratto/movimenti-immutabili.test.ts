import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, creaProdotto, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2.5 · Movimenti immutabili — il libro giornale non si tocca. Non esistono
 * policy di update/delete su movimenti_magazzino: ogni tentativo lascia la
 * riga intatta e presente.
 */
describe.skipIf(!haEnv())("Movimenti magazzino · append-only", () => {
  let T: Tenant;
  let prodotto: string;
  let movimentoId: string;

  beforeAll(async () => {
    T = await creaTenant("imm");
    prodotto = await creaProdotto(T);
    const { data, error } = await T.cli
      .from("movimenti_magazzino")
      .insert({ azienda_id: T.aziendaId, prodotto_id: prodotto, tipo: "carico", quantita: 7 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    movimentoId = data.id as string;
  });
  afterAll(pulisci);

  it("update su un movimento non ha effetto (nessuna policy) — la riga resta com'era", async () => {
    await T.cli.from("movimenti_magazzino").update({ quantita: 999 }).eq("id", movimentoId);
    const { data } = await T.cli
      .from("movimenti_magazzino")
      .select("quantita")
      .eq("id", movimentoId)
      .single();
    expect(data?.quantita).toBe(7);
  });

  it("delete su un movimento non ha effetto — la riga è ancora lì", async () => {
    await T.cli.from("movimenti_magazzino").delete().eq("id", movimentoId);
    const { data } = await T.cli
      .from("movimenti_magazzino")
      .select("id")
      .eq("id", movimentoId)
      .maybeSingle();
    expect(data?.id).toBe(movimentoId);
  });
});
