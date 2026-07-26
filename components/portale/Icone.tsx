import type { ReactElement } from "react";

/**
 * Icone a tratto del portale (G4 · punto: `Icon` del prototipo → un file solo).
 * La firma del marchio è la lente. Portate in Tailwind: nessuno stile inline,
 * il colore è `currentColor` così lo pilota una classe `text-*` sul contenitore.
 */

export type NomeIcona =
  | "occhio" | "occhiale" | "lente" | "bimbo" | "sole" | "chiave" | "scatola"
  | "luna" | "goccia" | "grafico" | "scudo" | "calendario" | "pin" | "orologio"
  | "telefono" | "documento" | "freccia" | "spunta" | "stella" | "chat"
  | "cuffie" | "bici" | "cerca" | "casa";

export function Icona({
  nome,
  size = 22,
  stroke = 1.7,
  className = "",
}: {
  nome: NomeIcona;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<NomeIcona, ReactElement> = {
    occhio: <><path {...p} d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle {...p} cx="12" cy="12" r="2.6" /></>,
    occhiale: <><circle {...p} cx="7" cy="13" r="4.2" /><circle {...p} cx="17" cy="13" r="4.2" /><path {...p} d="M11.2 13c.5-.9 1.1-.9 1.6 0M2.8 13l-1-3M21.2 13l1-3" /></>,
    lente: <><circle {...p} cx="12" cy="12" r="7.5" /><path {...p} d="M8.5 9.5a4.5 4.5 0 0 1 3-1.4" /></>,
    bimbo: <><circle {...p} cx="12" cy="8" r="3.6" /><path {...p} d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M9.5 4.5c.6-1 1.5-1.6 2.5-1.6s1.9.6 2.5 1.6" /></>,
    sole: <><circle {...p} cx="12" cy="12" r="4" /><path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>,
    chiave: <><path {...p} d="M14.5 3.5l6 6-3 3-2-2-2 2 1 1-3 3-6-6z" /><circle {...p} cx="6.5" cy="17.5" r="3" /></>,
    scatola: <><path {...p} d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16z" /><path {...p} d="M3.5 8L12 12.5 20.5 8M12 12.5V20.5" /></>,
    luna: <path {...p} d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
    goccia: <path {...p} d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
    grafico: <><path {...p} d="M4 20V4M4 20h16" /><path {...p} d="M7 15l4-4 3 2 5-6" /></>,
    scudo: <path {...p} d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" />,
    calendario: <><rect {...p} x="4" y="5.5" width="16" height="15" rx="2.5" /><path {...p} d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" /></>,
    pin: <><path {...p} d="M12 21s7-6.4 7-11.2A7 7 0 0 0 5 9.8C5 14.6 12 21 12 21z" /><circle {...p} cx="12" cy="9.8" r="2.4" /></>,
    orologio: <><circle {...p} cx="12" cy="12" r="8.5" /><path {...p} d="M12 7.5V12l3 2" /></>,
    telefono: <path {...p} d="M7 3.5h3l1.5 4.5-2 1.5a12 12 0 0 0 5 5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.2 5.7 2 2 0 0 1 5 3.5z" />,
    documento: <><path {...p} d="M7 3h7l4 4v14H7z" /><path {...p} d="M14 3v4h4M10 12h6M10 16h6" /></>,
    freccia: <path {...p} d="M9 6l6 6-6 6" />,
    spunta: <path {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
    stella: <path {...p} d="M12 4l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 15.8l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z" />,
    chat: <path {...p} d="M4 5.5h16v11H9l-5 4z" />,
    cuffie: <><path {...p} d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect {...p} x="3" y="14" width="4" height="6" rx="1.5" /><rect {...p} x="17" y="14" width="4" height="6" rx="1.5" /></>,
    bici: <><circle {...p} cx="6" cy="16.5" r="3.5" /><circle {...p} cx="18" cy="16.5" r="3.5" /><path {...p} d="M6 16.5l4-7h5l3 7M10 9.5h4M13 9.5l-2.5 7" /></>,
    cerca: <><circle {...p} cx="10.5" cy="10.5" r="6.5" /><path {...p} d="M15.5 15.5L21 21" /></>,
    casa: <><path {...p} d="M4 11l8-7 8 7v9h-16z" /><path {...p} d="M10 20v-6h4v6" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`block shrink-0 ${className}`} aria-hidden="true">
      {paths[nome]}
    </svg>
  );
}
