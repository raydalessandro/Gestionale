import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Icona } from "@/components/Icone";
import {
  ImpiantoScrivania,
  ProssimoAppuntamento,
  CosaPuoiFareAdesso,
  LaTuaGiornata,
  ElencoScrivania,
  type Gesto,
  type Fascia,
  type RigaScrivania,
} from "@/components/Scrivania";

/**
 * ANTEPRIMA DI DISEGNO — non è una schermata del prodotto.
 *
 * Serve a guardare la Scrivania sull'anteprima Vercel senza scrivere una sola
 * lettura di dati, che sarebbe fuori dal perimetro del design. **Ogni numero e
 * ogni nome qui dentro è finto**, e sono sempre gli stessi nomi finti del resto
 * della consegna (Marchetti Elena, BL-2026-0141, Ottica Aurora) più quelli del
 * prototipo.
 *
 * La rotta non è collegata da nessuna parte: non compare nella colonna, non è
 * in `lib/modules.ts`, e ci si arriva solo scrivendola. Quando i componenti
 * saranno alimentati dai dati veri, **questo file si cancella** — non si
 * aggiorna.
 *
 * Cosa serve per alimentarli davvero: `docs/design/dati-mancanti.md §7`.
 */

export const metadata = { robots: { index: false, follow: false } };

const GIORNATA: Fascia[] = [
  { id: "1", ora: "08:30", chi: "Negozio aperto", cosa: "da Sara", forma: "pausa" },
  { id: "2", ora: "09:00", chi: "Marco Rossi", cosa: "Controllo della vista · Sherien", forma: "ora", href: "/agenda" },
  { id: "3", ora: "09:45", chi: "Laura Verdi", cosa: "Consegna occhiali · Sara", href: "/agenda" },
  { id: "4", ora: "11:00", chi: "Andrea Bianchi", cosa: "Ritiro occhiali da sole", href: "/agenda" },
  { id: "5", ora: "12:30", chi: "Chiusura di mezzogiorno", cosa: "si riapre alle 14:30", forma: "pausa" },
  { id: "6", ora: "15:00", chi: "Paolo Neri", cosa: "Applicazione lenti a contatto · Sherien", href: "/agenda" },
  { id: "7", ora: "16:30", chi: "Davide Sacchi", cosa: "Ha disdetto alle 08:10", forma: "saltata", stato: { tinta: "rosso", testo: "da richiamare" }, href: "/agenda" },
  { id: "8", ora: "17:00", chi: "Cliente nuovo", cosa: "Controllo della vista · dal portale", stato: { tinta: "verde", testo: "da accettare" }, href: "/agenda" },
];

const GESTI: Gesto[] = [
  { id: "g1", tinta: "rosso", icona: "telefono", cosa: "Chiama Essilor", motivo: "Le lenti di Marco Rossi non sono arrivate e lui viene alle 09:00", durata: "~4 min", href: "/ordini" },
  { id: "g2", tinta: "verde", icona: "messaggio", cosa: "Avvisa Paolo Neri", motivo: "I suoi occhiali sono pronti da ieri", durata: "~2 min", href: "/ordini" },
  { id: "g3", tinta: "verde", icona: "messaggio", cosa: "Avvisa Laura Verdi", motivo: "Le lenti a contatto sono arrivate stamattina", durata: "~2 min", href: "/ordini" },
  { id: "g4", tinta: "blu", icona: "scatola-cerca", cosa: "Verifica il pacco Marcolin", motivo: "Arrivato alle 07:40, quattro montature da smistare", durata: "~6 min", href: "/magazzino" },
  { id: "g5", tinta: "blu", icona: "occhiale", cosa: "Prepara la consegna di Andrea Bianchi", motivo: "Ritiro fissato alle 11:00", durata: "~5 min", href: "/ordini" },
];

const ARRIVI: RigaScrivania[] = [
  { id: "a1", q: "Marcolin", m: "4 montature · magazzino e ordine di Andrea Bianchi", stato: { tinta: "blu", testo: "da verificare" }, href: "/magazzino" },
  { id: "a2", q: "Zeiss", m: "Lenti progressive di Marco Rossi", stato: { tinta: "rosso", testo: "non nel pacco" }, href: "/ordini" },
  { id: "a3", q: "Alcon", m: "Lenti a contatto di Laura Verdi", stato: { tinta: "verde", testo: "arrivato" }, href: "/ordini" },
  { id: "a4", q: "Luxottica", m: "2 montature su 3 · una manca", stato: { tinta: "blu", testo: "parziale" }, href: "/magazzino" },
];

const bottoncino =
  "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded border border-linea bg-white px-3.5 text-[13.5px] font-semibold text-inchiostro transition-colors duration-scatto hover:bg-carta";

const AVVISARE: RigaScrivania[] = [
  { id: "v1", q: "Paolo Neri", m: "Occhiali da vista · arrivati ieri", stato: { tinta: "grigio", testo: "da avvisare" }, azione: <span className={bottoncino}><Icona nome="messaggio" size={15} />WhatsApp</span> },
  { id: "v2", q: "Laura Verdi", m: "Lenti a contatto · arrivate stamattina", stato: { tinta: "blu", testo: "messaggio pronto" }, azione: <span className={bottoncino}><Icona nome="messaggio" size={15} />WhatsApp</span> },
  { id: "v3", q: "Franco Alberti", m: "Occhiali da sole · scritto il 03/08", stato: { tinta: "rosso", testo: "non risponde" }, azione: <span className={bottoncino}><Icona nome="telefono" size={15} />Chiama</span> },
];

const URGENTI: RigaScrivania[] = [
  { id: "u1", q: "Marco Rossi", m: "Lenti progressive · Essilor · promesse per oggi", grave: "In ritardo da 2 giorni · sentito il 01/08", azione: <span className={bottoncino}><Icona nome="telefono" size={15} />Chiama</span> },
  { id: "u2", q: "Andrea Bianchi", m: "Occhiali da sole · Marcolin · promessi per domani", grave: "Spedizione non confermata", azione: <span className={bottoncino}><Icona nome="telefono" size={15} />Chiama</span> },
];

export default function AnteprimaScrivania() {
  return (
    <>
      {/* Il nastro non è decorazione: senza, questa pagina è indistinguibile
          da una schermata vera piena di clienti che non esistono. */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded border-l-[3px] border-rosso-600 bg-rosso-50 px-4 py-3">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.15em] text-rosso-700">
          Anteprima di disegno
        </span>
        <span className="text-sm text-inchiostro">
          Ogni nome, ora e numero di questa pagina è <b className="font-semibold">finto</b>.
          Nessun dato viene letto dal database.
        </span>
        <Link
          href="/dashboard"
          className="ml-auto text-[13.5px] font-semibold text-inchiostro underline-offset-4 hover:underline"
        >
          Torna a Oggi →
        </Link>
      </div>

      <PageHeader titolo="Scrivania" sotto="Martedì 4 agosto · Ottica Aurora" />

      <ImpiantoScrivania
        sinistra={
          <>
            <ProssimoAppuntamento
              prossimo={{
                ora: "09:00",
                chi: "Marco Rossi",
                perche: "Controllo della vista · con te",
                manca: "Tra 58 minuti",
                percentuale: 18,
                allerta: {
                  titolo: "Le sue lenti non sono ancora arrivate",
                  testo:
                    "Essilor le aveva promesse per oggi. Meglio sentirli prima che lui esca di casa.",
                },
                href: "/agenda",
              }}
              vuoto={{
                titolo: "Nessun altro appuntamento oggi.",
                testo:
                  "Il primo di domani è alle 09:30, Elena Marchetti. Il pomeriggio è libero: quattordici clienti aspettano un richiamo per il controllo.",
                azione: (
                  <Link
                    href="/richiami"
                    className="inline-flex min-h-[44px] items-center rounded bg-inchiostro px-4 text-sm font-semibold text-carta hover:bg-black"
                  >
                    Apri i richiami
                  </Link>
                ),
              }}
            />
            <CosaPuoiFareAdesso
              gesti={GESTI}
              quantoTempo="58 minuti liberi"
              riassunto="Cinque cose, una ventina di minuti in tutto."
            />
            <LaTuaGiornata fasce={GIORNATA} spalla="6 appuntamenti · 1 da accettare" />
          </>
        }
        destra={
          <>
            <ElencoScrivania
              titolo="Arrivati oggi"
              spalla="4 consegne"
              righe={ARRIVI}
              piede={<span className="text-[13px] text-soft">Due non ancora verificate.</span>}
            />
            <ElencoScrivania
              titolo="Da avvisare"
              spalla="3 clienti"
              righe={AVVISARE}
              piede={
                <span className="text-[13px] text-soft">
                  Il messaggio si legge prima di partire.
                </span>
              }
            />
            <ElencoScrivania titolo="Ordini urgenti" spalla="promessa a rischio" righe={URGENTI} />
          </>
        }
      />
    </>
  );
}
