"use client";

import { Vuoto, Button } from "@/components/ui";
import { FiguraVuota } from "@/components/FigureVuote";

/**
 * La settima figura vuota: il guasto.
 *
 * È l'unico file nuovo sotto `app/(app)/` di questo ramo, e lo dichiaro perché
 * il perimetro dice di non riscrivere le pagine. Questo non riscrive niente:
 * è il confine d'errore del gruppo, e oggi non esiste — quando una lettura
 * fallisce compare la schermata predefinita di Next, che parla inglese e non
 * assomiglia al gestionale.
 *
 * Non tocca nessun dato e non cambia nessun flusso: si accende solo quando
 * qualcosa è già andato storto. Se non lo volete, si cancella il file e tutto
 * torna esattamente com'era.
 *
 * Il tono è «guasto», l'unico rosso delle sette figure. La copy dice cosa fare
 * adesso, non cosa è successo: al banco c'è un cliente che aspetta, e «Errore
 * 500» non lo aiuta.
 */
export default function ErroreGestionale({ reset }: { error: Error; reset: () => void }) {
  return (
    <Vuoto
      figura={<FiguraVuota nome="guasto" />}
      titolo="Il collegamento è caduto"
      testo="Non è colpa di quello che stavi facendo: niente è andato perso. Riprova fra un attimo — se insiste, la cosa più veloce è ricaricare la pagina."
      azione={
        <Button variante="primary" onClick={reset}>
          Riprova
        </Button>
      }
    />
  );
}
