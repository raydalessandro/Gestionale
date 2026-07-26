import type { Metadata } from "next";
import { Gabarito, Figtree } from "next/font/google";

/**
 * Layout del PORTALE pubblico (gruppo di rotte `(portale)`).
 *
 * Tre differenze deliberate dal gestionale:
 *  • font propri — Gabarito (display) e Figtree (testo) — esposti come variabili
 *    CSS dedicate, senza toccare i font del layout radice;
 *  • `robots: index/follow = true`, che SOVRASCRIVE il `noindex` messo dal
 *    layout radice su tutta l'app: la vetrina deve essere trovabile (è la prima
 *    riga della strategia SEO/AI). La guardia G13b sorveglia questo ribaltamento;
 *  • nessun elemento del gestionale: niente Sidebar, niente sessione, niente
 *    client Supabase autenticato. Solo il guscio pubblico.
 *
 * NB: il layout radice possiede già <html>/<body>; qui si avvolge solo in un
 * contenitore che porta le variabili-font e lo sfondo Limpidia (`lim-carta`).
 */
const gabarito = Gabarito({
  subsets: ["latin"],
  variable: "--font-lim-display",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-lim-testo",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function PortaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${gabarito.variable} ${figtree.variable} min-h-screen bg-lim-carta font-lim-testo text-lim-inchiostro antialiased`}
    >
      {children}
    </div>
  );
}
