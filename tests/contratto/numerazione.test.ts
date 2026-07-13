import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { creaTenant, pulisci, haEnv, type Tenant } from "./_helpers";

/**
 * L2.2 · prossimo_numero sotto concorrenza — 10 chiamate simultanee devono
 * dare 10 numeri unici e progressivi, senza collisioni fra postazioni.
 */
describe.skipIf(!haEnv())("Numerazione · prossimo_numero", () => {
  let T: Tenant;

  beforeAll(async () => {
    T = await creaTenant("num");
  });
  afterAll(pulisci);

  it("10 chiamate in parallelo → 10 numeri unici", async () => {
    const esiti = await Promise.all(
      Array.from({ length: 10 }, () => T.cli.rpc("prossimo_numero", { p_prefisso: "OL" }))
    );
    const numeri = esiti.map((e) => {
      expect(e.error).toBeNull();
      return e.data as string;
    });
    expect(new Set(numeri).size).toBe(10);
    // Tutti nel formato OL-AAAA-NNNN
    expect(numeri.every((n) => /^OL-\d{4}-\d{4}$/.test(n))).toBe(true);
  });

  it("la progressione è densa e senza buchi (0001..000N)", async () => {
    // Nuovo prefisso BL sullo stesso tenant: parte da 1 e cresce di 1.
    const a = (await T.cli.rpc("prossimo_numero", { p_prefisso: "BL" })).data as string;
    const b = (await T.cli.rpc("prossimo_numero", { p_prefisso: "BL" })).data as string;
    const na = Number(a.split("-").at(-1));
    const nb = Number(b.split("-").at(-1));
    expect(nb).toBe(na + 1);
  });

  it("prefisso non valido → errore (PREFISSO_NON_VALIDO)", async () => {
    const { error } = await T.cli.rpc("prossimo_numero", { p_prefisso: "ZZ" });
    expect(error).not.toBeNull();
  });

  it("i contatori restano invisibili ai client", async () => {
    const { data } = await T.cli.from("contatori").select("*");
    expect(data ?? []).toEqual([]);
  });
});
