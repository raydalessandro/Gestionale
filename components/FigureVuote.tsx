import type { ReactElement } from "react";

/**
 * Le sette figure vuote — DS-01 §5.3.
 *
 * Sono la quinta delle cinque famiglie di segni, e non vanno confuse con le
 * icone: riquadro 120 invece di 24, tratto 1.8, densità bassa, uso a ~112px.
 * Una figura vuota non è un'icona ingrandita — a 120 il tratto 1.75 delle
 * icone diventa un filo e il disegno si smaglia.
 *
 * ── I quattro toni ────────────────────────────────────────────────────────
 * Questa è la parte che conta, e la più facile da sbagliare: **due elenchi
 * vuoti su quattro sono buone notizie**, e non devono sembrare tristi.
 *
 *   Invito     — non hai cominciato   · contorno tratteggiato · neutro
 *   Conferma   — hai finito           · contorno pieno        · verde
 *   Correzione — non ho trovato       · contorno misto        · neutro
 *   Guasto     — si è rotto qualcosa  · contorno pieno        · rosso
 *
 * **Nessuna usa l'ambra.** L'azione è il pulsante sotto la figura, non la
 * figura: se il disegno fosse ambra competerebbe col suo stesso pulsante.
 *
 * ── Perché il tono non è una prop ─────────────────────────────────────────
 * Ogni figura porta il suo tono dentro di sé. «Fatto» è verde sempre,
 * «guasto» è rosso sempre: se il tono fosse scegliibile da fuori, prima o poi
 * qualcuno metterebbe un catalogo vuoto in rosso e un guasto in grigio, e i
 * quattro toni smetterebbero di voler dire qualcosa. Un nome, un significato.
 *
 * ── La copy conta più del disegno ─────────────────────────────────────────
 * Uno stato vuoto non dice «nessun risultato»: dice **quando smetterà di
 * essere vuoto, e con quanti**. «Il prossimo gruppo matura lunedì 3 agosto:
 * sono undici clienti» è una schermata vuota che fa lavorare. «Nessun
 * risultato» è una schermata vuota che sembra rotta.
 */

export type NomeFigura =
  | "clienti"   // invito     · l'anagrafica non è cominciata
  | "ordini"    // invito     · nessuna busta, nessun ordine LAC
  | "magazzino" // invito     · catalogo senza prodotti
  | "agenda"    // invito     · giornata senza appuntamenti
  | "fatto"     // conferma   · non c'è niente da fare, ed è una buona notizia
  | "cerca"     // correzione · la ricerca non ha trovato
  | "guasto";   // guasto     · la lettura è fallita

type Tono = "invito" | "conferma" | "correzione" | "guasto";

const TONO: Record<NomeFigura, Tono> = {
  clienti: "invito",
  ordini: "invito",
  magazzino: "invito",
  agenda: "invito",
  fatto: "conferma",
  cerca: "correzione",
  guasto: "guasto",
};

/** Il contorno dice il tono prima del colore: chi non distingue verde da rosso
 *  legge lo stesso «non cominciato» da un tratteggio. Nessuna informazione
 *  viaggia sul colore da sola. */
const TRATTEGGIO: Record<Tono, string | undefined> = {
  invito: "7 6",
  conferma: undefined,
  correzione: "7 6", // il misto: le parti piene lo annullano con `strokeDasharray="none"`
  guasto: undefined,
};

const COLORE: Record<Tono, string> = {
  // neutro-400: il 300 su bianco è un fantasma, il 500 pesa quanto il testo
  invito: "text-neutro-400",
  conferma: "text-verde-500",
  correzione: "text-neutro-400",
  guasto: "text-rosso-500",
};

export function FiguraVuota({
  nome,
  size = 112,
  className = "",
}: {
  nome: NomeFigura;
  size?: number;
  className?: string;
}) {
  const tono = TONO[nome];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={TRATTEGGIO[tono]}
      className={`${COLORE[tono]} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {FIGURE[nome]}
    </svg>
  );
}

const FIGURE: Record<NomeFigura, ReactElement> = {
  /* Invito · una scheda che aspetta di essere riempita. */
  clienti: (
    <>
      <rect x="22" y="26" width="76" height="68" rx="7" />
      <circle cx="60" cy="55" r="13" />
      <path d="M39 84c3-11 11-16.6 21-16.6S78 73 81 84" />
    </>
  ),

  /* Invito · la busta lavoro, chiusa e ancora senza niente dentro. */
  ordini: (
    <>
      <rect x="18" y="32" width="84" height="56" rx="6" />
      <path d="M18 38l42 28 42-28" />
      <path d="M34 78h22" />
    </>
  ),

  /* Invito · uno scaffale con tre ripiani e nulla sopra. Il vuoto qui è
     letterale: si vede lo spazio, non l'assenza di un disegno. */
  magazzino: (
    <>
      <path d="M22 26v68M98 26v68" />
      <path d="M22 50h76M22 72h76M22 94h76" />
      <path d="M16 100h12M92 100h12" />
    </>
  ),

  /* Invito · un giorno con le righe delle ore e nessuna occupata. */
  agenda: (
    <>
      <rect x="22" y="30" width="76" height="64" rx="7" />
      <path d="M22 48h76M42 22v14M78 22v14" />
      <path d="M36 64h48M36 78h32" />
    </>
  ),

  /* Conferma · hai finito. Il segno più semplice che esista, in verde e
     pieno: non c'è niente da fare, e va detto come una buona notizia. */
  fatto: (
    <>
      <circle cx="60" cy="60" r="33" />
      <path d="M45 61l11 11 22-24" />
    </>
  ),

  /* Correzione · il contorno misto, e qui è letterale invece che decorativo:
     **il manico è pieno perché la ricerca è avvenuta davvero**, la lente è
     tratteggiata perché dentro non c'è niente. Dice «ho cercato, non ho
     trovato» — che è un'altra cosa da «non hai ancora cominciato». */
  cerca: (
    <>
      <circle cx="54" cy="54" r="28" />
      <path d="M74.5 74.5L96 96" strokeDasharray="none" />
    </>
  ),

  /* Guasto · i due punti del marchio con l'asse spezzato, e le due metà
     sfalsate. Limpidia è il tratto che unisce: quando il collegamento cade,
     il tratto si rompe. È l'unico posto del sistema in cui la firma del
     marchio viene usata al contrario. */
  guasto: (
    <>
      <circle cx="34" cy="60" r="8" fill="currentColor" stroke="none" />
      <circle cx="86" cy="60" r="8" fill="currentColor" stroke="none" />
      <path d="M46 56h10M64 64h10" />
    </>
  ),
};
