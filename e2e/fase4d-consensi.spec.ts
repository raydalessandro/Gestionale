import { test, expect } from "@playwright/test";
import { registraTenant, creaCliente, unico } from "./_helpers";

/**
 * L3 · E2E — Fase 4d · Consensi (audit A6).
 * Collaudo S1: un cliente nuovo senza consensi mostra il banner persistente;
 * registrando i consensi (data retrodatabile, come da carta) il banner si
 * svuota una riga alla volta e la scheda mostra le date.
 *
 * Selettori: solo testo/etichetta reali del banner (getByText/getByLabel/
 * getByRole), nessun CSS/data-testid. Tenant usa-e-getta per run.
 */
test.describe("Fase 4d · Consensi", () => {
  test("S1 · il banner elenca i consensi mancanti e si svuota registrandoli", async ({ page }) => {
    await registraTenant(page);
    // Cliente nuovo SENZA consenso marketing → mancano entrambi (il sanitario
    // nasce sempre vuoto: si raccoglie alla prima prescrizione).
    await creaCliente(page, { nome: "Nuovo", cognome: `SenzaConsensi ${unico()}` });

    // Banner presente con entrambe le voci mancanti.
    await expect(page.getByText("Consenso marketing: non raccolto")).toBeVisible();
    await expect(page.getByText("Consenso dati sanitari: non raccolto")).toBeVisible();

    // Apro il dialogo e registro il MARKETING con data di ieri (raccolto su carta).
    await page.getByRole("button", { name: "Registra consensi" }).click();
    const ieri = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
    await page.getByLabel(/^Consenso marketing/).check();
    await page.getByLabel("data consenso marketing").fill(ieri);
    await page.getByRole("button", { name: "Salva consensi" }).click();

    // Dopo il salvataggio (revalidate) la riga marketing sparisce, resta il sanitario.
    // Questo È il collaudo S1: il banner ora elenca solo il consenso sanitario.
    await expect(page.getByText("Consenso marketing: non raccolto")).toHaveCount(0);
    await expect(page.getByText("Consenso dati sanitari: non raccolto")).toBeVisible();

    // Il dialogo resta aperto (stato client): registro anche il SANITARIO senza
    // riaprirlo → il banner sparisce del tutto.
    await page.getByLabel(/^Consenso dati sanitari/).check();
    await page.getByRole("button", { name: "Salva consensi" }).click();

    await expect(page.getByText("Consenso dati sanitari: non raccolto")).toHaveCount(0);
    // La sezione privacy della scheda ora dichiara i consensi come raccolti.
    await expect(page.getByText(/Marketing:\s*sì/i)).toBeVisible();
    await expect(page.getByText(/Dati sanitari:\s*sì/i)).toBeVisible();
  });
});
