import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  creaTenant,
  creaUtente,
  slugDiTest,
  anonClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2.6 · Onboarding — la rpc crea_azienda_con_titolare è l'unico varco per
 * creare un'azienda. Difende dai doppioni: stesso utente due volte, slug già
 * preso.
 */
describe.skipIf(!haEnv())("Onboarding · crea_azienda_con_titolare", () => {
  let T: Tenant;

  beforeAll(async () => {
    T = await creaTenant("onb");
  });
  afterAll(pulisci);

  it("seconda chiamata dallo stesso utente → UTENTE_GIA_REGISTRATO", async () => {
    const { error } = await T.cli.rpc("crea_azienda_con_titolare", {
      p_nome_azienda: "Ottica Doppione",
      p_slug: slugDiTest("onb-bis"),
      p_nome_utente: "Titolare",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("UTENTE_GIA_REGISTRATO");
  });

  it("slug già in uso (altro utente) → 23505", async () => {
    const altro = await creaUtente("onb2");
    const { error } = await altro.cli.rpc("crea_azienda_con_titolare", {
      p_nome_azienda: `Ottica Clone ${RUN_ID}`,
      p_slug: T.slug, // stesso slug del tenant già creato
      p_nome_utente: "Titolare Clone",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23505");
  });

  it("un client anonimo NON autenticato non può creare aziende", async () => {
    // Nessun utente loggato: la rpc è grant solo a `authenticated`.
    const { error } = await anonClient().rpc("crea_azienda_con_titolare", {
      p_nome_azienda: "X",
      p_slug: slugDiTest("anon"),
      p_nome_utente: "X",
    });
    expect(error).not.toBeNull();
  });
});
