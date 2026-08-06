import { test, expect } from "@playwright/test";
import { registraTenant, creaCliente, rigaMarketing, unico } from "./_helpers";

/**
 * L3 · E2E — Fase 4d · Consensi (audit A6).
 * Collaudo S1: un cliente nuovo senza consenso mostra il banner persistente;
 * registrandolo (data retrodatabile, come da carta) il banner sparisce e la
 * scheda mostra la data.
 *
 * ⚠️ RISCRITTO alla consegna B1. Il banner della 4d chiedeva DUE consensi
 * (marketing + sanitario) con due spunte booleane. Il contratto C3 ha portato
 * via il marketing: `consenso_marketing` è la CACHE dell'ultimo evento del
 * mastro e «la cache non si scrive MAI direttamente». Oggi
 * `components/ConsensiCliente.tsx` chiede SOLO i dati sanitari (bottoni
 * «Consenso sanitario» e «Salva il consenso sanitario») e il marketing si
 * raccoglie dalla sezione «Permessi» (collaudata da `m1-anagrafiche.spec.ts`
 * S2/S3). Il pezzo di S1 che sopravvive è quello sanitario — ed è anche il più
 * importante, perché è il gate delle prescrizioni.
 *
 * Selettori: solo testo/etichetta/ruolo reali del banner, nessun CSS/data-testid.
 * Tenant usa-e-getta per run.
 */
test.describe("Fase 4d · Consensi", () => {
  test("S1 · il banner chiede il consenso sanitario e si svuota registrandolo", async ({ page }) => {
    await registraTenant(page);
    await creaCliente(page, { nome: "Nuovo", cognome: `SenzaConsensi ${unico()}` });

    // Il banner c'è, e chiede UNA cosa sola: i dati sanitari.
    await expect(page.getByText("Consenso dati sanitari: non raccolto")).toBeVisible();
    // Il marketing NON passa più di qui (C3): niente spunta nel banner.
    await expect(page.getByRole("checkbox", { name: /marketing/i })).toHaveCount(0);
    // Lo stato del marketing si legge dov'è la sua verità, in «Permessi».
    await expect(rigaMarketing(page)).toHaveText(/^Marketing:\s*non raccolto$/);

    // Apro il dialogo e registro il sanitario con data di IERI (raccolto su carta).
    await page.getByRole("button", { name: "Consenso sanitario" }).click();
    const ieri = new Date(Date.now() - 24 * 3600_000);
    const ieriIso = ieri.toISOString().slice(0, 10);
    await page.getByRole("checkbox", { name: /Consenso dati sanitari/ }).check();
    await page.getByLabel("data consenso sanitario").fill(ieriIso);
    await page.getByRole("button", { name: "Salva il consenso sanitario" }).click();

    // Dopo il salvataggio (revalidate) il banner sparisce del tutto…
    await expect(page.getByText("Consenso dati sanitari: non raccolto")).toHaveCount(0);
    // …e la card Privacy dichiara il consenso con la data RETRODATATA. La data
    // si ricostruisce come fa il server (mezzogiorno della data scelta), non da
    // `Date.now()`: così un run a cavallo della mezzanotte non sposta il giorno.
    const atteso = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
      new Date(`${ieriIso}T12:00:00`)
    );
    await expect(page.getByText(/^Dati sanitari:/)).toContainText(`sì, dal ${atteso}`);

    // Prova di separazione (C3): il flusso sanitario non ha toccato la cache
    // marketing — che infatti è ancora «non raccolto», non «no».
    await expect(rigaMarketing(page)).toHaveText(/^Marketing:\s*non raccolto$/);
  });
});
