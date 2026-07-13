import { test, expect } from "@playwright/test";
import {
  registraTenant,
  creaCliente,
  aziendaIdDaSlug,
  seedBustaProntaScaduta,
  seedLacConsegnato,
} from "./_helpers";

/**
 * L3 · Fase 3 — collaudo S3 (la proposta che diventa incasso) e S4 (GDPR sul
 * campo). Scenari 1:1 da docs/fasi/fase-3-agenda-richiami.md §7.
 *
 * Questi scenari dipendono dal TEMPO (buste pronte da >3gg, LAC consegnate
 * ~80gg fa): impossibili da produrre dalla UI in un tenant nuovo. Si RETRODATA
 * con la service role (seed helper). Quindi girano solo dove esiste
 * TEST_SUPABASE_SERVICE_ROLE_KEY (la CI). Da validare contro l'app viva.
 */

test.describe("Fase 3 · Agenda & Richiami", () => {
  test.skip(
    !process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
    "Il seeding retrodatato richiede la service role del progetto di test."
  );

  test("S3 · Proposta ritiro (busta pronta >3gg) → esito → redirect in agenda", async ({ page }) => {
    const { slug } = await registraTenant(page);
    const aziendaId = await aziendaIdDaSlug(slug);
    const clienteId = await creaCliente(page, {
      nome: "Rosa",
      cognome: "Conti",
      telefono: "3339998888",
    });
    const numero = await seedBustaProntaScaduta(aziendaId, clienteId);

    await page.goto("/richiami");
    // La proposta compare con tipo "Sollecito ritiro" e il riferimento busta.
    await expect(page.getByText("Sollecito ritiro").first()).toBeVisible();
    await expect(page.getByText(numero)).toBeVisible();

    // Registra esito: telefono, appuntamento fissato → redirect in agenda.
    await page.getByRole("button", { name: "Registra esito" }).first().click();
    const combo = page.getByRole("combobox");
    await combo.nth(0).selectOption({ label: "Telefono" });
    await combo.nth(1).selectOption({ label: "Appuntamento fissato" });
    await page.getByRole("button", { name: "Salva esito" }).click();

    await page.waitForURL(/\/agenda\/nuovo/);
    expect(page.url()).toContain(`cliente=${clienteId}`);
  });

  test("S4 · GDPR: LAC in esaurimento sparisce togliendo il consenso", async ({ page }) => {
    const { slug } = await registraTenant(page);
    const aziendaId = await aziendaIdDaSlug(slug);
    const clienteId = await creaCliente(page, {
      nome: "Ivo",
      cognome: "Mari",
      telefono: "3337776666",
      consensoMarketing: true,
    });
    await seedLacConsegnato(aziendaId, clienteId);

    // Con consenso: la proposta commerciale compare.
    await page.goto("/richiami");
    await expect(page.getByText("LAC in esaurimento").first()).toBeVisible();

    // Tolgo il consenso marketing dalla scheda cliente.
    await page.goto(`/clienti/${clienteId}/modifica`);
    await page.getByLabel(/Consenso marketing/).uncheck();
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await page.waitForURL(new RegExp(`/clienti/${clienteId}$`));

    // Ora la proposta è nascosta e compare l'avviso "proposte commerciali nascoste".
    await page.goto("/richiami");
    await expect(page.getByText("LAC in esaurimento")).toHaveCount(0);
    await expect(page.getByText(/proposte commerciali nascoste/i)).toBeVisible();
  });
});
