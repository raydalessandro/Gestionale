import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  creaTenant,
  creaCliente,
  serviceClient,
  pulisci,
  haEnv,
  RUN_ID,
  type Tenant,
} from "./_helpers";

/**
 * L2 · Contratto — Migrazione 007 (Fase 4c caparra + 4d consensi).
 * Additiva, zero nuove tabelle: le colonne viaggiano sulle policy RLS esistenti.
 *  • ordini_occhiali: acconto_metodo (testo libero), acconto_incassato_il
 *    (timestamptz), garanzia_tipo ∈ (servizio,polizza)
 *  • resi.busta_id: FK → ordini_occhiali con ON DELETE SET NULL
 *  • clienti.consenso_sanitario_il: timestamptz retrodatabile
 * Il backfill dichiarato (acconto_incassato_il = created_at per le buste già con
 * acconto) NON è verificabile a contratto: agisce una volta sola, all'apply, su
 * righe preesistenti — vedi report-test.md.
 */
describe.skipIf(!haEnv())("007 · Caparra in cassa & consenso sanitario", () => {
  let A: Tenant;
  let clienteA: string;

  async function busta(extra: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await A.cli
      .from("ordini_occhiali")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteA,
        numero: `BL-CAP-${RUN_ID}-${Math.random().toString(36).slice(2, 7)}`,
        totale: 200,
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw new Error(`busta: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    A = await creaTenant("cap");
    clienteA = await creaCliente(A);
  });
  afterAll(pulisci);

  /* ── ordini_occhiali · metodo/data caparra e garanzia tipizzata ──────── */

  it("acconto_metodo e acconto_incassato_il si scrivono liberamente", async () => {
    const id = await busta({
      acconto: 100,
      acconto_metodo: "Mastercard",
      acconto_incassato_il: "2026-07-16T09:30:00Z",
    });
    const { data, error } = await A.cli
      .from("ordini_occhiali")
      .select("acconto_metodo, acconto_incassato_il")
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    expect(data!.acconto_metodo).toBe("Mastercard");
    expect(data!.acconto_incassato_il).not.toBeNull();
  });

  it("garanzia_tipo accetta 'servizio'/'polizza' e rifiuta altro", async () => {
    const servizio = await A.cli
      .from("ordini_occhiali")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteA,
        numero: `BL-GS-${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
        totale: 100,
        garanzia_tipo: "servizio",
      });
    expect(servizio.error).toBeNull();

    const polizza = await A.cli
      .from("ordini_occhiali")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteA,
        numero: `BL-GP-${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
        totale: 100,
        garanzia_tipo: "polizza",
      });
    expect(polizza.error).toBeNull();

    const ko = await A.cli
      .from("ordini_occhiali")
      .insert({
        azienda_id: A.aziendaId,
        cliente_id: clienteA,
        numero: `BL-GK-${RUN_ID}-${Math.random().toString(36).slice(2, 6)}`,
        totale: 100,
        garanzia_tipo: "estesa",
      });
    expect(ko.error).not.toBeNull();
  });

  /* ── resi.busta_id · FK verso la busta, ON DELETE SET NULL ───────────── */

  it("resi.busta_id accetta una busta esistente e rifiuta un id inesistente (FK)", async () => {
    const b = await busta({ acconto: 80, acconto_metodo: "Contanti" });
    const { data, error } = await A.cli.rpc("prossimo_numero", { p_prefisso: "RE" });
    expect(error).toBeNull();
    const numero = data as string;

    const ok = await A.cli.from("resi").insert({
      azienda_id: A.aziendaId,
      numero,
      tipo: "denaro",
      causale: "soddisfatti_rimborsati",
      importo: 80,
      metodo_rimborso: "Contanti",
      busta_id: b,
    });
    expect(ok.error).toBeNull();

    const { data: d2 } = await A.cli.rpc("prossimo_numero", { p_prefisso: "RE" });
    const ko = await A.cli.from("resi").insert({
      azienda_id: A.aziendaId,
      numero: d2 as string,
      tipo: "denaro",
      causale: "soddisfatti_rimborsati",
      importo: 10,
      busta_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(ko.error?.code).toBe("23503"); // foreign_key_violation
  });

  it("ON DELETE SET NULL · cancellata la busta, resi.busta_id torna null (il reso resta)", async () => {
    const b = await busta({ acconto: 50 });
    const { data: n } = await A.cli.rpc("prossimo_numero", { p_prefisso: "RE" });
    const { data: reso, error } = await A.cli
      .from("resi")
      .insert({
        azienda_id: A.aziendaId,
        numero: n as string,
        tipo: "denaro",
        causale: "soddisfatti_rimborsati",
        importo: 50,
        busta_id: b,
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    // La cancellazione della busta la fa il service role (l'app non cancella mai
    // righe di dominio, cfr. guardia L4): qui serve solo a esercitare la FK.
    const svc = serviceClient();
    const del = await svc.from("ordini_occhiali").delete().eq("id", b);
    expect(del.error).toBeNull();

    const { data: dopo } = await A.cli
      .from("resi")
      .select("id, busta_id")
      .eq("id", reso!.id)
      .single();
    expect(dopo!.id).toBe(reso!.id); // il reso è ancora lì
    expect(dopo!.busta_id).toBeNull(); // il legame si è azzerato, non cancellato
  });

  /* ── clienti · consenso sanitario retrodatabile (4d) ─────────────────── */

  it("clienti.consenso_sanitario_il si scrive (anche retrodatato) accanto al consenso", async () => {
    // Nota di contratto: consenso_dati_sanitari è timestamptz (dal 002), NON un
    // boolean; l'action registraConsensi ci scrive la data del consenso. La 007
    // aggiunge consenso_sanitario_il come àncora esplicita, entrambi retrodatabili.
    const c = await creaCliente(A);
    const { error } = await A.cli
      .from("clienti")
      .update({
        consenso_dati_sanitari: "2025-01-10T00:00:00Z",
        consenso_sanitario_il: "2025-01-10T00:00:00Z",
      })
      .eq("id", c);
    expect(error).toBeNull();

    const { data } = await A.cli
      .from("clienti")
      .select("consenso_dati_sanitari, consenso_sanitario_il")
      .eq("id", c)
      .single();
    expect(data!.consenso_dati_sanitari).not.toBeNull();
    expect(data!.consenso_sanitario_il).not.toBeNull();
  });
});
