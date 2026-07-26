import Link from "next/link";
import type { ReactNode } from "react";
import type { Fonte } from "@/lib/database.types";

/* ── Superfici ─────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-linea bg-white p-5 shadow-[0_1px_2px_rgba(28,23,20,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  titolo,
  sotto,
  azione,
}: {
  titolo: string;
  sotto?: string;
  azione?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="f-serif text-2xl font-semibold tracking-tight text-inchiostro md:text-3xl">
          {titolo}
        </h1>
        {sotto && <p className="mt-1 text-sm text-soft">{sotto}</p>}
      </div>
      {azione}
    </div>
  );
}

/* ── Azioni ────────────────────────────────────────────────────────── */

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const btnVarianti = {
  primary: "bg-inchiostro text-carta hover:bg-black",
  accent: "bg-ottone text-white hover:bg-ottone-scuro",
  ghost:
    "border border-linea bg-white text-inchiostro hover:border-faint hover:bg-carta",
} as const;

export function Button({
  children,
  variante = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  variante?: keyof typeof btnVarianti;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${btnBase} ${btnVarianti[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variante = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variante?: keyof typeof btnVarianti;
  className?: string;
}) {
  return (
    <Link href={href} className={`${btnBase} ${btnVarianti[variante]} ${className}`}>
      {children}
    </Link>
  );
}

/* ── Form ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-linea bg-white px-3.5 py-2.5 text-sm text-inchiostro placeholder:text-faint focus:border-ottone focus:outline-none focus:ring-2 focus:ring-ottone-soft";

export function Errore({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl border border-rosso/30 bg-rosso-soft px-4 py-3 text-sm text-rosso">
      {msg}
    </div>
  );
}

/* ── Badge stato/fonte ─────────────────────────────────────────────── */

const badgeTinte = {
  verde: "bg-verde-soft text-verde",
  ambra: "bg-ambra-soft text-ambra",
  blu: "bg-blu-soft text-blu",
  rosso: "bg-rosso-soft text-rosso",
  neutro: "bg-carta text-soft border border-linea",
  ottone: "bg-ottone-soft text-ottone-scuro",
} as const;

export function Badge({
  children,
  tinta = "neutro",
}: {
  children: ReactNode;
  tinta?: keyof typeof badgeTinte;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeTinte[tinta]}`}
    >
      {children}
    </span>
  );
}

/** Tinta del badge per ogni fonte. Deriva dal vocabolario unico: se aggiungi
 *  una fonte a FONTI e scordi la tinta, TypeScript qui non compila. L'input è
 *  tollerante (una fonte sconosciuta a runtime cade su "neutro"). */
const TINTE_FONTE: Record<Fonte, keyof typeof badgeTinte> = {
  banco: "neutro",
  app: "verde",
  convenzione: "ottone",
  import: "neutro",
  qr_vetrina: "ambra",
  sito_negozio: "blu",
  portale: "ambra",
};

export function tintaFonte(fonte: string): keyof typeof badgeTinte {
  return TINTE_FONTE[fonte as Fonte] ?? "neutro";
}

/* ── Vuoti ─────────────────────────────────────────────────────────── */

export function Vuoto({
  titolo,
  testo,
  azione,
}: {
  titolo: string;
  testo?: string;
  azione?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="f-serif text-lg text-inchiostro">{titolo}</p>
      {testo && <p className="max-w-sm text-sm text-soft">{testo}</p>}
      {azione && <div className="mt-2">{azione}</div>}
    </Card>
  );
}
