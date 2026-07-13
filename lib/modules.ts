/**
 * Registry dei moduli del gestionale — stesso pattern della demo:
 * metadata server-safe, i componenti vivono nelle rispettive route.
 */
export interface ModuloGestionale {
  id: string;
  nome: string;
  href: string;
  icona: "dashboard" | "clienti" | "prescrizioni" | "ordini" | "magazzino" | "cassa" | "agenda" | "richiami";
  attivo: boolean;
  nota?: string;
}

export const MODULI: ModuloGestionale[] = [
  { id: "dashboard", nome: "Dashboard", href: "/dashboard", icona: "dashboard", attivo: true },
  { id: "clienti", nome: "Clienti", href: "/clienti", icona: "clienti", attivo: true },
  { id: "ordini", nome: "Ordini & Buste", href: "/ordini", icona: "ordini", attivo: true },
  { id: "magazzino", nome: "Magazzino", href: "/magazzino", icona: "magazzino", attivo: true },
  { id: "agenda", nome: "Agenda", href: "/agenda", icona: "agenda", attivo: true },
  { id: "richiami", nome: "Richiami", href: "/richiami", icona: "richiami", attivo: true },
  { id: "cassa", nome: "Cassa", href: "/cassa", icona: "cassa", attivo: true },
];
