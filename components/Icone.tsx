import type { ReactElement } from "react";

/**
 * Icone del gestionale Limpidia — set proprietario, sostituisce lucide-react.
 *
 * Grammatica (non derogabile, vedi tavola design 05):
 *  • riquadro 24×24, area viva 2–22
 *  • tratto 1.75, estremi e giunzioni tonde
 *  • colore da `currentColor`: si pilota con una classe `text-*` sul contenitore
 *  • nessun fill, tranne i punti pieni che citano il simbolo del marchio
 *
 * Dimensioni d'uso: 17px nella barra, 16px nei pulsanti, 20px nelle schede,
 * 24px negli stati vuoti. Sotto i 14px non sono garantite.
 */

export type NomeIcona =
  | "dashboard"
  | "clienti"
  | "ordini"
  | "magazzino"
  | "agenda"
  | "richiami"
  | "cassa"
  | "prescrizione"
  | "occhiale"
  | "sole"
  | "occhio"
  | "nascondi"
  | "lente"
  | "progressiva"
  | "lac"
  | "forottero"
  | "astuccio"
  | "montaggio"
  | "gruppo"
  | "titolare"
  | "telefono"
  | "email"
  | "messaggio"
  | "cerca"
  | "piu"
  | "meno"
  | "matita"
  | "cestino"
  | "salva"
  | "stampa"
  | "esporta"
  | "importa"
  | "filtro"
  | "ordina"
  | "allegato"
  | "nota"
  | "spunta"
  | "croce"
  | "attesa"
  | "attenzione"
  | "info"
  | "blocco"
  | "campanello"
  | "storia"
  | "contanti"
  | "carta"
  | "caparra"
  | "scontrino"
  | "sconto"
  | "scatola"
  | "fornitore"
  | "consegna"
  | "reso"
  | "impostazioni"
  | "esci"
  | "grafico"
  | "freccia-sx"
  | "freccia-dx"
  | "giu"
  | "tre-punti";

export function Icona({
  nome,
  size = 18,
  stroke = 1.75,
  className = "",
}: {
  nome: NomeIcona;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {TRACCIATI[nome]}
    </svg>
  );
}

const TRACCIATI: Record<NomeIcona, ReactElement> = {
  "dashboard": <><rect x="3" y="3" width="7.5" height="9" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6"/><rect x="3" y="15" width="7.5" height="6" rx="1.6"/></>,
  "clienti": <><circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-3.7 3.6-5.6 7-5.6s6.2 1.9 7 5.6"/></>,
  "ordini": <><rect x="2.8" y="5.5" width="18.4" height="13.5" rx="2.2"/><path d="M2.8 8.5l9.2 5 9.2-5"/><circle cx="12" cy="15.4" r="2.1"/></>,
  "magazzino": <><path d="M3.5 7.6L12 3.4l8.5 4.2v8.8L12 20.6 3.5 16.4z"/><path d="M3.5 7.6L12 11.9l8.5-4.3M12 11.9v8.7"/></>,
  "agenda": <><rect x="3.2" y="5" width="17.6" height="16" rx="2.4"/><path d="M3.2 10h17.6M8 2.8v4.4M16 2.8v4.4"/><circle cx="9" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1.3" fill="currentColor" stroke="none"/></>,
  "richiami": <><path d="M4.6 3.8h3.7l1.6 4.1-2.1 1.6a11.8 11.8 0 0 0 5.7 5.7l1.6-2.1 4.1 1.6v3.7a1.6 1.6 0 0 1-1.7 1.6C9.4 19.9 4.1 14.6 3 5.5a1.6 1.6 0 0 1 1.6-1.7z"/></>,
  "cassa": <><rect x="2.8" y="9" width="18.4" height="11.6" rx="2"/><path d="M2.8 13.4h18.4"/><rect x="6.4" y="3.4" width="11.2" height="5.6" rx="1.4"/><path d="M9.4 6.2h5.2"/><path d="M6.6 17h3.2"/></>,
  "prescrizione": <><rect x="4" y="2.8" width="16" height="18.4" rx="2.2"/><path d="M7.5 14.5h9"/><circle cx="10" cy="14.5" r="1.9" fill="currentColor" stroke="none"/><circle cx="14" cy="14.5" r="1.9" fill="currentColor" stroke="none"/><path d="M8 7h8"/></>,
  "occhiale": <><circle cx="6.9" cy="13.2" r="4.3"/><circle cx="17.1" cy="13.2" r="4.3"/><path d="M11.2 13c.5-1 1.1-1 1.6 0M2.6 12.6L1.7 9.6M21.4 12.6l.9-3"/></>,
  "sole": <><circle cx="6.9" cy="13.2" r="4.3"/><circle cx="17.1" cy="13.2" r="4.3"/><path d="M11.2 13c.5-1 1.1-1 1.6 0M2.6 12.6L1.7 9.6M21.4 12.6l.9-3"/><path d="M4.6 15L9 10.9M14.8 15l4.4-4.1"/></>,
  "occhio": <><path d="M2.4 12S6 6.2 12 6.2 21.6 12 21.6 12 18 17.8 12 17.8 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="2.7"/></>,
  "nascondi": <><path d="M4 5.2l16 13.6"/><path d="M9.3 7.1A9.6 9.6 0 0 1 12 6.7c6 0 9.6 5.5 9.6 5.5a17 17 0 0 1-3.2 3.6"/><path d="M6.6 8.5A16.4 16.4 0 0 0 2.4 12.2s3.6 5.5 9.6 5.5a9.7 9.7 0 0 0 3.3-.6"/><path d="M10.2 10.5a2.7 2.7 0 0 0 3.6 3.9"/></>,
  "lente": <><circle cx="12" cy="12" r="7.8"/><path d="M8 9.4a5 5 0 0 1 3.4-1.6"/></>,
  "progressiva": <><circle cx="12" cy="12" r="7.8"/><path d="M6.6 8.6h10.8M8 12h8M9.6 15.4h4.8"/></>,
  "lac": <><path d="M3.8 14.2a8.2 8.2 0 0 1 16.4 0"/><path d="M3.8 14.2a8.2 3.5 0 0 0 16.4 0"/><path d="M7.6 11.4a5 5 0 0 1 3.3-2.2"/></>,
  "forottero": <><circle cx="12" cy="12" r="8"/><path d="M4.4 12h15.2"/><circle cx="9" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/></>,
  "astuccio": <><rect x="2.6" y="7.4" width="18.8" height="9.2" rx="4.6"/><path d="M3 10.6h18M6.8 10.6v6"/></>,
  "montaggio": <><circle cx="12" cy="12" r="5.2"/><path d="M4.4 8.2v7.6M6.8 8.2v7.6M19.6 8.2v7.6M17.2 8.2v7.6"/><path d="M4.4 12h2.4M17.2 12h2.4"/></>,
  "gruppo": <><circle cx="9" cy="8.4" r="3.3"/><path d="M2.6 20c.7-3.4 3.3-5.2 6.4-5.2s5.7 1.8 6.4 5.2"/><path d="M16.6 5.6a3.3 3.3 0 0 1 0 5.6M18.4 20a8.4 8.4 0 0 0-1.3-3.6"/></>,
  "titolare": <><circle cx="10" cy="8.2" r="3.4"/><path d="M3.4 20c.8-3.5 3.4-5.4 6.6-5.4 1.1 0 2.1.2 3 .6"/><path d="M17.8 14.2l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/></>,
  "telefono": <><rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.6"/><path d="M10.6 5.6h2.8"/><circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none"/></>,
  "email": <><rect x="2.8" y="5" width="18.4" height="14" rx="2.4"/><path d="M3.2 7.6L12 13.4l8.8-5.8"/></>,
  "messaggio": <><path d="M20.8 12.6c0 3.8-3.9 6.9-8.8 6.9a11 11 0 0 1-2.6-.3L4.2 21l1.3-3.6a6.4 6.4 0 0 1-2.3-4.8c0-3.8 4-6.9 8.8-6.9s8.8 3.1 8.8 6.9z"/></>,
  "cerca": <><circle cx="10.8" cy="10.8" r="7"/><path d="M15.9 15.9L21 21"/></>,
  "piu": <><path d="M12 4.8v14.4M4.8 12h14.4"/></>,
  "meno": <><path d="M4.8 12h14.4"/></>,
  "matita": <><path d="M16.4 3.6l4 4L8.2 19.8l-5 1 1-5z"/><path d="M14.2 5.8l4 4"/></>,
  "cestino": <><path d="M3.8 6.2h16.4M8.4 6.2V4.4a1.6 1.6 0 0 1 1.6-1.6h4a1.6 1.6 0 0 1 1.6 1.6v1.8"/><path d="M5.8 6.2l1 13a2 2 0 0 0 2 1.8h6.4a2 2 0 0 0 2-1.8l1-13"/><path d="M10.4 10.4v6M13.6 10.4v6"/></>,
  "salva": <><path d="M4.6 3.4h11.6L20.6 7.8v11.2a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6V5a1.6 1.6 0 0 1 1.2-1.6z"/><path d="M7.6 3.4v5.2h8V3.4M7.6 20.6v-6.4h8.8v6.4"/></>,
  "stampa": <><path d="M7 8.6V3.4h10v5.2"/><rect x="3.4" y="8.6" width="17.2" height="7.6" rx="2"/><path d="M7 13.4h10v7.2H7z"/></>,
  "esporta": <><path d="M12 15.6V3.6M8.2 7.2L12 3.4l3.8 3.8"/><path d="M4.4 14.6v4.2a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8v-4.2"/></>,
  "importa": <><path d="M12 3.4v12M8.2 11.8L12 15.6l3.8-3.8"/><path d="M4.4 14.6v4.2a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8v-4.2"/></>,
  "filtro": <><path d="M3.4 5.4h17.2l-6.6 7.6v6.4l-4 1.4v-7.8z"/></>,
  "ordina": <><path d="M7.4 4.6v14.8M4.2 16.2l3.2 3.2 3.2-3.2"/><path d="M16.6 19.4V4.6M13.4 7.8l3.2-3.2 3.2 3.2"/></>,
  "allegato": <><path d="M20 11.4l-8.6 8.6a5 5 0 0 1-7-7L13.4 4a3.3 3.3 0 0 1 4.7 4.7l-8.7 8.7a1.7 1.7 0 0 1-2.3-2.3l7.9-7.9"/></>,
  "nota": <><path d="M4 4.6a1.8 1.8 0 0 1 1.8-1.8h12.4A1.8 1.8 0 0 1 20 4.6v10.6L14.6 21H5.8A1.8 1.8 0 0 1 4 19.2z"/><path d="M20 15.2h-4a1.4 1.4 0 0 0-1.4 1.4V21"/><path d="M7.6 8h8M7.6 11.6h5"/></>,
  "spunta": <><path d="M4.6 12.6l4.8 4.8L19.4 7"/></>,
  "croce": <><path d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></>,
  "attesa": <><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/></>,
  "attenzione": <><path d="M13.5 3.6l8.1 14.2a1.7 1.7 0 0 1-1.5 2.6H3.9a1.7 1.7 0 0 1-1.5-2.6L10.5 3.6a1.7 1.7 0 0 1 3 0z"/><path d="M12 9v4.2"/><circle cx="12" cy="16.7" r="1.1" fill="currentColor" stroke="none"/></>,
  "info": <><circle cx="12" cy="12" r="8.8"/><path d="M12 11.4v5"/><circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none"/></>,
  "blocco": <><rect x="4.4" y="10.2" width="15.2" height="10.6" rx="2.2"/><path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.4 0v2.8"/></>,
  "campanello": <><path d="M18.2 16.6H5.8l1.5-2.4V10a4.7 4.7 0 0 1 9.4 0v4.2z"/><path d="M10.2 19.4a2 2 0 0 0 3.6 0"/></>,
  "storia": <><path d="M3.4 12a8.6 8.6 0 1 0 2.6-6.1"/><path d="M3.4 4.4V9h4.6"/><path d="M12 8v4.4l3 1.8"/></>,
  "contanti": <><rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.4v5.2M18 9.4v5.2"/></>,
  "carta": <><rect x="2.6" y="5" width="18.8" height="14" rx="2.4"/><path d="M2.6 9.6h18.8"/><path d="M6.4 14.6h3.4"/></>,
  "caparra": <><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none"/></>,
  "scontrino": <><path d="M5.4 2.9h13.2v18.2l-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5z"/><path d="M8.6 7.6h6.8M8.6 11.4h6.8M8.6 15.2h4"/></>,
  "sconto": <><path d="M11.4 2.9H20a1.2 1.2 0 0 1 1.2 1.2v8.5L11.9 21a1.6 1.6 0 0 1-2.3 0L3 14.4a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.6" cy="7.4" r="1.5"/></>,
  "scatola": <><rect x="3" y="7.4" width="18" height="13.2" rx="1.8"/><path d="M3 11.8h18"/><path d="M8.6 7.4L12 3.4l3.4 4"/><path d="M10.2 15.4h3.6"/></>,
  "fornitore": <><path d="M2.6 6.6h10.6v9.8H2.6z"/><path d="M13.2 10.2h4l3.2 3.2v3h-7.2z"/><circle cx="6.6" cy="18.4" r="2"/><circle cx="17" cy="18.4" r="2"/></>,
  "consegna": <><path d="M3.4 8.4L12 3.6l8.6 4.8v7.2L12 20.4l-8.6-4.8z"/><path d="M8.6 11.8l2.4 2.4 4.4-4.4"/></>,
  "reso": <><path d="M3.4 8.4L12 3.6l8.6 4.8v7.2L12 20.4l-8.6-4.8z"/><path d="M14.6 12H9.4M11.6 9.4L9 12l2.6 2.6"/></>,
  "impostazioni": <><circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2"/><path d="M5.3 5.3l2.3 2.3M16.4 16.4l2.3 2.3M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3"/></>,
  "esci": <><path d="M9.4 20.6H5.8a1.8 1.8 0 0 1-1.8-1.8V5.2a1.8 1.8 0 0 1 1.8-1.8h3.6"/><path d="M15.6 16.6L20.2 12l-4.6-4.6M20.2 12H9.4"/></>,
  "grafico": <><path d="M3.6 20.4V3.6M3.6 20.4h16.8"/><path d="M7.4 15.4l4-4 2.8 2.2 4.8-6"/></>,
  "freccia-sx": <><path d="M20 12H4.4M10.8 5.6L4.4 12l6.4 6.4"/></>,
  "freccia-dx": <><path d="M4 12h15.6M13.2 5.6L19.6 12l-6.4 6.4"/></>,
  "giu": <><path d="M5.6 9.2L12 15.6l6.4-6.4"/></>,
  "tre-punti": <><circle cx="5.4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
};
