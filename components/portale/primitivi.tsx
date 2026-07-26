import type { ReactNode } from "react";

/**
 * Primitivi del portale (G4): `Btn`, `Tag`, `Card`, `Eyebrow` del prototipo,
 * riscritti in Tailwind con i token `lim-*`. Presentazionali e senza stato —
 * nessun `onClick`, nessuno stile inline: in questa consegna il portale è tutto
 * server component. L'interattività (wizard) arriva in G6/G7.
 */

type TintaBtn = "primary" | "dark" | "ghost";

const BTN: Record<TintaBtn, string> = {
  primary: "bg-lim-ambra text-white",
  dark: "bg-lim-inchiostro text-white",
  ghost: "bg-white text-lim-inchiostro border border-lim-linea",
};

/**
 * Bottone presentazionale. `disabled` lo rende inerte e opaco — è la forma del
 * CTA «Prenotazione in arrivo» di G4, che occupa già la sua posizione definitiva
 * ma non fa nulla finché G6/G7 non lo collegano.
 */
export function Btn({
  children,
  tinta = "primary",
  full = false,
  disabled = false,
  onClick,
  className = "",
}: {
  children: ReactNode;
  tinta?: TintaBtn;
  full?: boolean;
  disabled?: boolean;
  /** Se presente, il bottone è interattivo (usato dal percorso di prenotazione). */
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex min-h-[52px] items-center justify-center rounded-2xl px-6 py-4 text-base font-semibold",
        full ? "w-full" : "",
        disabled ? "cursor-default bg-lim-linea text-lim-soft" : `${BTN[tinta]} cursor-pointer`,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

type TintaTag = "line" | "white";

const TAG: Record<TintaTag, string> = {
  line: "bg-transparent text-lim-soft border border-lim-linea",
  white: "bg-white/15 text-white border border-white/35",
};

export function Tag({ children, tinta = "line" }: { children: ReactNode; tinta?: TintaTag }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${TAG[tinta]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-lim-linea bg-white p-[18px] ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.08em] text-lim-faint">
      {children}
    </p>
  );
}
