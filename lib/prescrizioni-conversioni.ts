/**
 * M2 §2-bis — conversioni di supporto per prescrizioni.
 *
 * Le funzioni sono intenzionalmente pure: non conoscono database, form o ruoli.
 * Il chiamante può sempre sostituire il risultato clinico proposto.
 */

/** Arrotondamento clinico di visualizzazione, senza accumulare imprecisioni JS. */
function arrotondaDiottria(valore: number): number {
  return Math.round((valore + Number.EPSILON) * 100) / 100;
}

/**
 * Data di scadenza proposta dalla data reale e dalla validità. Gestisce il
 * cambio mese/anno senza spostare oltre l'ultimo giorno del mese destinazione.
 * L'azione B2 conserva una modifica manuale marcandola come sticky.
 */
export function calcolaScadenzaProposta(dataVisita: string, validitaMesi: number): string {
  const [anno, mese, giorno] = dataVisita.split("-").map(Number);
  const totale = anno * 12 + (mese - 1) + validitaMesi;
  const annoDestinazione = Math.floor(totale / 12);
  const meseDestinazione = (totale % 12) + 1;
  const ultimoGiorno = new Date(Date.UTC(annoDestinazione, meseDestinazione, 0)).getUTCDate();
  return `${String(annoDestinazione).padStart(4, "0")}-${String(meseDestinazione).padStart(2, "0")}-${String(Math.min(giorno, ultimoGiorno)).padStart(2, "0")}`;
}

/** Intermedio = lontano + (ADD / 2), solo quando entrambi i dati esistono. */
export function calcolaIntermedio(
  lontano: number | null,
  addizione: number | null
): number | null {
  if (lontano === null || addizione === null) return null;
  return arrotondaDiottria(lontano + addizione / 2);
}

/** Office = lontano + ADD; l'intermedio non viene mai derivato automaticamente. */
export function calcolaOffice(
  lontano: number | null,
  addizione: number | null
): number | null {
  if (lontano === null || addizione === null) return null;
  return arrotondaDiottria(lontano + addizione);
}

/**
 * Compensazione di distanza al vertice.
 *
 * Formula: F_lente = F_occhiale / (1 - distanza_metri × F_occhiale).
 * M2 richiede il calcolo soltanto oltre ±4,00 D: alla soglia il valore resta
 * invariato. La distanza standard di 12 mm è sovrascrivibile dal chiamante.
 */
export function compensaDistanzaVertice(
  potere: number | null,
  distanzaMm = 12
): number | null {
  if (potere === null || Math.abs(potere) <= 4) return potere;
  return arrotondaDiottria(potere / (1 - (distanzaMm / 1000) * potere));
}
