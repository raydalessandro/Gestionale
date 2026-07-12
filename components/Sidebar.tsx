"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  Boxes,
  CalendarDays,
  Receipt,
  LogOut,
  Lock,
} from "lucide-react";
import { MODULI } from "@/lib/modules";

const ICONE = {
  dashboard: LayoutDashboard,
  clienti: Users,
  prescrizioni: FileText,
  ordini: Package,
  magazzino: Boxes,
  agenda: CalendarDays,
  cassa: Receipt,
} as const;

export default function Sidebar({
  aziendaNome,
  utenteNome,
}: {
  aziendaNome: string;
  utenteNome: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto border-b border-black/20 bg-inchiostro px-3 py-2 text-carta md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:border-b-0 md:border-r md:px-4 md:py-6">
      {/* Wordmark */}
      <Link href="/dashboard" className="mr-2 flex items-baseline gap-1.5 md:mb-8 md:mr-0">
        <span className="f-serif text-xl font-semibold tracking-tight">VISTA</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ottone">
          gestionale
        </span>
      </Link>

      {/* Moduli */}
      <nav className="flex flex-row gap-1 md:flex-1 md:flex-col">
        {MODULI.map((m) => {
          const Icona = ICONE[m.icona];
          const attivo = pathname.startsWith(m.href);
          if (!m.attivo) {
            return (
              <span
                key={m.id}
                title={`In arrivo · ${m.nota}`}
                className="hidden items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-carta/35 md:flex"
              >
                <Icona size={17} strokeWidth={2} />
                <span className="flex-1">{m.nome}</span>
                <Lock size={12} />
              </span>
            );
          }
          return (
            <Link
              key={m.id}
              href={m.href}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors ${
                attivo
                  ? "bg-carta/10 font-semibold text-carta"
                  : "text-carta/70 hover:bg-carta/5 hover:text-carta"
              }`}
            >
              <Icona size={17} strokeWidth={2} />
              {m.nome}
            </Link>
          );
        })}
      </nav>

      {/* Azienda + logout */}
      <div className="ml-auto flex items-center gap-2 md:ml-0 md:mt-6 md:block md:border-t md:border-carta/10 md:pt-4">
        <div className="hidden md:block">
          <p className="truncate text-sm font-semibold">{aziendaNome}</p>
          <p className="truncate text-xs text-carta/50">{utenteNome}</p>
        </div>
        <form action="/auth/signout" method="post" className="md:mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-carta/60 transition-colors hover:bg-carta/5 hover:text-carta"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Esci</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
