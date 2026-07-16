-- ============================================================================
-- SEED — lo storico che a mano non puoi retrodatare
-- ============================================================================
-- Riempie l'azienda PIÙ VECCHIA del database di lavoro con clienti, catalogo
-- e storia realistici, da trattare come dati veri a tutti gli effetti:
-- niente tag, niente pulizia prevista. Serve a dare al collaudo ciò che
-- l'inserimento manuale non può creare: prescrizioni di 13 mesi fa, LAC
-- consegnate 80 giorni fa, caparre già a metodo — i richiami e la cassa si
-- accendono da soli.
--
-- USO: incollare TUTTO nel SQL Editor di Supabase ed eseguire UNA volta.
--      Se hai più aziende, sostituisci la riga marcata >>> AZIENDA <<<.
--      Guardia inclusa: se la busta BL-2026-9001 esiste già, non fa nulla.
--      La serie 9xxx dei numeri non collide coi progressivi veri.
-- ============================================================================

do $$
declare
  v_azienda uuid;
  v_utente  uuid;
  v_id      uuid;
  v_c       uuid[] := '{}';   -- id clienti, in ordine
  v_rx      uuid[] := '{}';   -- id prescrizioni
  v_lac1    uuid; v_lac2 uuid; v_mont1 uuid;
  v_oggi    date := current_date;
begin
  -- >>> AZIENDA <<< (default: la più vecchia)
  select id into v_azienda from public.aziende order by created_at limit 1;
  if v_azienda is null then raise exception 'Nessuna azienda: registrati prima dal gestionale.'; end if;
  select id into v_utente from public.utenti where azienda_id = v_azienda order by created_at limit 1;
  if v_utente is null then raise exception 'Nessun utente per l''azienda.'; end if;
  if exists (select 1 from public.ordini_occhiali where azienda_id = v_azienda and numero = 'BL-2026-9001') then
    raise notice 'Seed già presente (BL-2026-9001 esiste): niente da fare.'; return;
  end if;

  -- ──────────────────────────────────────────────────────────────────────
  -- CATALOGO (24 prodotti) + carico iniziale via movimenti
  -- ──────────────────────────────────────────────────────────────────────
  create temp table _sp (id uuid, tipo text, qta int) on commit drop;

  with ins as (
    insert into public.prodotti (azienda_id, tipo, marca, nome, descrizione, sku, prezzo, costo, fornitore, scorta_minima, ricambio_giorni, parametri, attivo)
    values
      (v_azienda,'montatura','Ray-Ban','RB5154 Clubmaster','Acetato nero lucido','RB5154-2000-51',163,65,'Luxottica',2,null,'{"calibro":51,"ponte":21,"asta":145,"colore_codice":"2000","colore_nome":"Nero lucido","materiale":"acetato"}',true),
      (v_azienda,'montatura','Persol','PO3007V','Havana','PO3007V-24-52',189,78,'Luxottica',2,null,'{"calibro":52,"ponte":20,"asta":145,"colore_codice":"24","colore_nome":"Havana","materiale":"acetato"}',true),
      (v_azienda,'montatura','Silhouette','TMA Unify','Titanio glasant','SIL-UNIFY-7110',329,140,'Silhouette',1,null,'{"calibro":54,"ponte":19,"asta":150,"colore_codice":"7110","colore_nome":"Oro rosa","materiale":"titanio"}',true),
      (v_azienda,'montatura','Oakley','OX8046 Airdrop','Satin black','OX8046-01-53',141,58,'Luxottica',2,null,'{"calibro":53,"ponte":18,"asta":143,"colore_codice":"01","colore_nome":"Satin black","materiale":"O-Matter"}',true),
      (v_azienda,'montatura','Prada','PR 16MV','Tartaruga','PR16MV-2AU-53',245,102,'Luxottica',1,null,'{"calibro":53,"ponte":17,"asta":140,"colore_codice":"2AU","colore_nome":"Tartaruga","materiale":"acetato"}',true),
      (v_azienda,'montatura','Vogue','VO5406','Trasparente rosa','VO5406-2828-50',95,38,'Luxottica',2,null,'{"calibro":50,"ponte":18,"asta":140,"colore_codice":"2828","colore_nome":"Rosa trasparente","materiale":"iniettato"}',true),
      (v_azienda,'sole','Ray-Ban','RB2140 Wayfarer','G-15 classico','RB2140-901-50',158,63,'Luxottica',2,null,'{"calibro":50,"ponte":22,"asta":150,"colore_codice":"901","colore_nome":"Nero","materiale":"acetato"}',true),
      (v_azienda,'sole','Persol','PO0714 pieghevole','Havana polar','PO0714-2457-54',289,120,'Luxottica',1,null,'{"calibro":54,"ponte":21,"asta":140,"colore_codice":"24/57","colore_nome":"Havana","materiale":"acetato"}',true),
      (v_azienda,'sole','Oakley','Holbrook','Prizm black','OO9102-HOLB-55',131,54,'Luxottica',2,null,'{"calibro":55,"ponte":18,"asta":137,"colore_codice":"9102","colore_nome":"Matte black","materiale":"O-Matter"}',true),
      (v_azienda,'sole','Polaroid','PLD 2100/S','Polarizzato blu','PLD2100-PJP-56',59,22,'Safilo',3,null,'{"calibro":56,"ponte":17,"asta":140,"colore_codice":"PJP","colore_nome":"Blu","materiale":"iniettato"}',true),
      (v_azienda,'lente','Essilor','CR39 1.5 AR','Monofocale antiriflesso','ESS-CR39-AR',45,12,'Essilor',4,null,'{"indice":1.5,"geometria":"monofocale","trattamenti":["AR"]}',true),
      (v_azienda,'lente','Essilor','1.6 AR Blue','Monofocale blue control','ESS-16-ARBLUE',85,24,'Essilor',4,null,'{"indice":1.6,"geometria":"monofocale","trattamenti":["AR","blue"]}',true),
      (v_azienda,'lente','Hoya','1.67 Hi-Index AR','Monofocale assottigliata','HOYA-167-AR',145,45,'Hoya',2,null,'{"indice":1.67,"geometria":"monofocale","trattamenti":["AR","idro"]}',true),
      (v_azienda,'lente','Essilor','Varilux Comfort 1.6','Progressiva','VARILUX-CMF-16',260,95,'Essilor',2,null,'{"indice":1.6,"geometria":"progressiva","trattamenti":["AR"]}',true),
      (v_azienda,'lac','Acuvue','Oasys 1-Day x30','Giornaliere silicone-hydrogel','ACU-OASYS1D-30',32,14,'Johnson&Johnson',6,1,'{"raggio":8.5,"diametro":14.3,"confezione":30}',true),
      (v_azienda,'lac','Alcon','Total30 x6','Mensili water-gradient','ALC-TOTAL30-6',45,19,'Alcon',4,30,'{"raggio":8.4,"diametro":14.2,"confezione":6}',true),
      (v_azienda,'lac','CooperVision','Biofinity x6','Mensili comfort','CV-BIOFIN-6',38,15,'CooperVision',4,30,'{"raggio":8.6,"diametro":14.0,"confezione":6}',true),
      (v_azienda,'lac','Acuvue','Moist 1-Day Astig x30','Giornaliere toriche','ACU-MOISTAST-30',39,17,'Johnson&Johnson',4,1,'{"raggio":8.5,"diametro":14.5,"confezione":30}',true),
      (v_azienda,'soluzione','Alcon','Opti-Free 300ml','Soluzione unica','ALC-OPTIFREE-300',12,4.5,'Alcon',6,null,'{"formato_ml":300}',true),
      (v_azienda,'soluzione','iWear','Dynamic 360ml','Soluzione unica','IW-DYNAMIC-360',10,3.8,'Essilor',6,null,'{"formato_ml":360}',true),
      (v_azienda,'accessorio','—','Catenella occhiali','Metallo dorato','ACC-CATENELLA',15,4,'—',3,null,'{}',true),
      (v_azienda,'accessorio','—','Astuccio rigido','Nero con panno','ACC-ASTUCCIO',9,2.5,'—',5,null,'{}',true),
      (v_azienda,'servizio','—','Pulizia a ultrasuoni','Manutenzione in negozio','SRV-ULTRASUONI',5,0,null,0,null,'{}',true),
      (v_azienda,'servizio','—','Riparazione montatura','Saldatura/ricambi','SRV-RIPARAZIONE',25,0,null,0,null,'{}',true)
    returning id, tipo
  )
  insert into _sp select id, tipo, case tipo when 'montatura' then 4 when 'sole' then 6 when 'lente' then 8 when 'lac' then 10 when 'soluzione' then 12 when 'accessorio' then 6 else 0 end from ins;

  insert into public.movimenti_magazzino (azienda_id, prodotto_id, utente_id, tipo, quantita, riferimento)
    select v_azienda, id, v_utente, 'carico', qta, 'carico iniziale' from _sp where qta > 0;

  select id into v_mont1 from public.prodotti where azienda_id = v_azienda and sku = 'RB5154-2000-51';
  select id into v_lac1  from public.prodotti where azienda_id = v_azienda and sku = 'ALC-TOTAL30-6';
  select id into v_lac2  from public.prodotti where azienda_id = v_azienda and sku = 'ACU-OASYS1D-30';

  -- ──────────────────────────────────────────────────────────────────────
  -- CLIENTI (14) — storie diverse, richiami che si accendono da soli
  -- ──────────────────────────────────────────────────────────────────────
  with ins as (
    insert into public.clienti (azienda_id, nome, cognome, data_nascita, email, telefono, citta, cap, provincia, fonte, canale_preferito, consenso_marketing, data_consenso, consenso_dati_sanitari, consenso_sanitario_il, sesso, note)
    values
      (v_azienda,'Marco','Fontana', make_date(1968, extract(month from v_oggi)::int, 12),'marco.fontana@example.com','3401110001','Cesano Boscone','20090','MI','banco','telefono', true, v_oggi - 400, v_oggi - 400, v_oggi - 400, 'M',null),
      (v_azienda,'Giulia','Serra', '1985-04-22','giulia.serra@example.com','3401110002','Corsico','20094','MI','banco','whatsapp', true, v_oggi - 90, v_oggi - 90, v_oggi - 90,  'F',null),
      (v_azienda,'Luca','Moretti', '1992-09-03','luca.moretti@example.com','3401110003','Trezzano','20090','MI','sito','email',   true, v_oggi - 120, v_oggi - 120, v_oggi - 120, 'M',null),
      (v_azienda,'Anna','Colombo', '1957-01-15',null,'3401110004','Cusago','20047','MI','banco','telefono', false, null, v_oggi - 30, v_oggi - 30,  'F',null),
      (v_azienda,'Paolo','Rinaldi','1979-11-08','paolo.rinaldi@example.com','3401110005','Buccinasco','20090','MI','banco','sms', true, v_oggi - 200, v_oggi - 200, v_oggi - 200, 'M',null),
      (v_azienda,'Elena','Greco',  '2011-06-30',null,'3401110006','Corsico','20094','MI','banco','telefono', false, null, v_oggi - 15, v_oggi - 15,  'F',null),
      (v_azienda,'Sara','Villa',   '1990-02-14','sara.villa@example.com','3401110007','Milano','20147','MI','convenzione','whatsapp', true, v_oggi - 60, null, null, 'F',null),
      (v_azienda,'Franco','Barbieri','1948-07-19',null,'3401110008','Cesano Boscone','20090','MI','banco','telefono', true, v_oggi - 300, v_oggi - 300, v_oggi - 300,'M',null),
      (v_azienda,'Chiara','Ferri', '1996-12-01','chiara.ferri@example.com','3401110009','Trezzano','20090','MI','sito','email',  true, v_oggi - 45, null, null, 'F',null),
      (v_azienda,'Davide','Longo', '1983-03-27','davide.longo@example.com','3401110010','Cusago','20047','MI','banco','whatsapp', true, v_oggi - 150, v_oggi - 150, v_oggi - 150,'M',null),
      (v_azienda,'Roberta','Costa','1971-08-05',null,'3401110011','Corsico','20094','MI','banco','telefono', false, null, null, null, 'F',null),
      (v_azienda,'Simone','Riva',  '2000-05-17','simone.riva@example.com','3401110012','Milano','20147','MI','app','email',      true, v_oggi - 20, v_oggi - 20, v_oggi - 20, 'M',null),
      (v_azienda,'Laura','Negri',  '1963-10-23','laura.negri@example.com','3401110013','Buccinasco','20090','MI','banco','telefono', true, v_oggi - 500, v_oggi - 500, v_oggi - 500,'F',null),
      (v_azienda,'Ahmed','Nasser', '1988-01-09',null,'3401110014','Milano','20146','MI','banco','whatsapp', true, v_oggi - 10, null, null, 'M',null)
    returning id
  ) select array_agg(id) into v_c from ins;

  update public.clienti set tutore_legale = 'Maria Greco (madre)' where id = v_c[6];
  update public.clienti set non_contattare = true where id = v_c[11];

  -- ──────────────────────────────────────────────────────────────────────
  -- PRESCRIZIONI — quella di Laura ha 13 mesi: il richiamo si accende
  -- ──────────────────────────────────────────────────────────────────────
  create temp table _rx (k int, id uuid) on commit drop;
  with ins as (
      insert into public.prescrizioni (azienda_id, cliente_id, tipo, data_visita, utente_id, origine, esaminatore, uso, od_sfero, od_cilindro, od_asse, os_sfero, os_cilindro, os_asse, addizione, od_dnp, os_dnp, validita_mesi, note)
      values
        (v_azienda, v_c[13],'occhiali', v_oggi - interval '13 months', v_utente,'interna','Dott. Bianchi','lontano',-2.25,-0.75,175,-2.50,-0.50,10, 2.25, 31.5, 31.0, 12, 'progressiva matura'),
        (v_azienda, v_c[1], 'occhiali', v_oggi - interval '2 months',  v_utente,'interna','Dott. Bianchi','lontano',-1.50, null,null,-1.75, null,null, 2.00, 32.0, 32.0, 12, null),
        (v_azienda, v_c[2], 'occhiali', v_oggi - interval '20 days',   v_utente,'esterna','Dr.ssa Riva (oculista)','lontano',-3.25,-1.25,20,-3.00,-1.00,160,null, 30.5, 30.5, 12, null),
        (v_azienda, v_c[3], 'lac',      v_oggi - interval '80 days',   v_utente,'interna','Dott. Bianchi','lontano',-2.75,null,null,-2.50,null,null,null, null,null, 12, null),
        (v_azienda, v_c[5], 'occhiali', v_oggi - interval '4 months',  v_utente,'interna','Dott. Bianchi','lontano', 1.25, 0.50,90, 1.00, 0.75,85, null, 33.0, 32.5, 12, null),
        (v_azienda, v_c[6], 'occhiali', v_oggi - interval '15 days',   v_utente,'esterna','Osp. San Carlo','lontano',-0.75,null,null,-1.00,null,null,null, 28.0, 28.0, 12, 'minore'),
        (v_azienda, v_c[8], 'occhiali', v_oggi - interval '14 months', v_utente,'interna','Dott. Bianchi','lontano', 2.00,null,null, 2.25,null,null, 2.75, 31.0, 31.0, 12, null),
        (v_azienda, v_c[10],'occhiali', v_oggi - interval '1 month',   v_utente,'interna','Dott. Bianchi','lontano',-4.50,-0.50,5,-4.25,-0.75,170,null, 30.0, 30.5, 12, null)
      returning id
  )
  insert into _rx select row_number() over (), id from ins;
  update public.prescrizioni set od_raggio = 8.4, od_diametro = 14.2, os_raggio = 8.4, os_diametro = 14.2 where id = (select id from _rx where k = 4);

  -- ──────────────────────────────────────────────────────────────────────
  -- BUSTE — sei stati, caparre con metodo e data (numeri serie 9xxx)
  -- ──────────────────────────────────────────────────────────────────────
  insert into public.ordini_occhiali (azienda_id, cliente_id, prescrizione_id, numero, fonte, stato, tipo_lavoro, montatura_marca, montatura_modello, montatura_colore, montatura_calibro, prezzo_montatura, lente_tipo, lente_indice, trattamenti, prezzo_lenti, od_dnp, os_dnp, garanzia, garanzia_tipo, prezzo_extra, totale, acconto, acconto_metodo, acconto_incassato_il, data_promessa, data_consegna, note, created_at)
  values
    (v_azienda, v_c[4], null,                          'BL-2026-9001','banco','preventivo','occhiale_completo','Vogue','VO5406','Rosa trasparente','50-18',95,'monofocale','1.5','{AR}',90, 31.0,31.0, null,null, 0, 185, 0, null, null, null, null, 'preventivo da richiamare', v_oggi - interval '1 day'),
    (v_azienda, v_c[2], (select id from _rx where k=3),'BL-2026-9002','banco','lavorazione','occhiale_completo','Ray-Ban','RB5154 Clubmaster','Nero lucido','51-21',163,'monofocale','1.6','{AR,blue}',170, 30.5,30.5, 'Otticare 24','servizio', 25, 358, 100, 'Contanti', now(), v_oggi + 6, null, 'caparra di OGGI in contanti', now()),
    (v_azienda, v_c[10],(select id from _rx where k=8),'BL-2026-9003','banco','arrivata','occhiale_completo','Persol','PO3007V','Havana','52-20',189,'monofocale','1.67','{AR,idro}',290, 30.0,30.5, null,null, 0, 479, 200, 'Bancomat', v_oggi - interval '5 days', v_oggi + 2, null, null, v_oggi - interval '6 days'),
    (v_azienda, v_c[5], (select id from _rx where k=5),'BL-2026-9004','banco','pronta','occhiale_completo','Oakley','OX8046 Airdrop','Satin black','53-18',141,'monofocale','1.6','{AR}',170, 33.0,32.5, 'ERGO Meta','polizza', 35, 346, 150, 'Contanti', v_oggi - interval '9 days', v_oggi - 6, null, 'pronta in ritardo: sollecito', v_oggi - interval '10 days'),
    (v_azienda, v_c[1], (select id from _rx where k=2),'BL-2026-9005','banco','consegnata','occhiale_completo','Silhouette','TMA Unify','Oro rosa','54-19',329,'progressiva','1.6','{AR}',420, 32.0,32.0, null,null, 0, 749, 250, 'Mastercard', v_oggi - interval '45 days', v_oggi - 40, v_oggi - 38, 'storico', v_oggi - interval '45 days'),
    (v_azienda, v_c[9], null,                          'BL-2026-9006','banco','annullata','solo_montatura','Prada','PR 16MV','Tartaruga','53-17',245,null,null,'{}',0, null,null, null,null, 0, 245, 150, 'Contanti', v_oggi - interval '85 days', v_oggi - 80, null, 'mai ritirata: caparra incamerata', v_oggi - interval '85 days');

  update public.ordini_occhiali set caparra_incamerata_il = v_oggi - interval '20 days' where numero = 'BL-2026-9006' and azienda_id = v_azienda;

  -- ──────────────────────────────────────────────────────────────────────
  -- ORDINI LAC — uno consegnato 80 giorni fa: l'esaurimento chiama
  -- ──────────────────────────────────────────────────────────────────────
  insert into public.ordini_lac (azienda_id, cliente_id, prescrizione_id, numero, fonte, stato, righe, totale, acconto, data_arrivo_prevista, data_consegna, note, created_at)
  values
    (v_azienda, v_c[3], (select id from _rx where k=4),'OL-2026-9001','banco','consegnato',
      jsonb_build_array(
        jsonb_build_object('prodotto_id', v_lac1, 'descrizione','Total30 x6 — OD','occhio','OD','quantita',2,'prezzo',45,'parametri', jsonb_build_object('sfero',-2.75,'raggio',8.4,'diametro',14.2)),
        jsonb_build_object('prodotto_id', v_lac1, 'descrizione','Total30 x6 — OS','occhio','OS','quantita',2,'prezzo',45,'parametri', jsonb_build_object('sfero',-2.50,'raggio',8.4,'diametro',14.2))
      ), 180, 0, v_oggi - 84, v_oggi - 80, 'esaurimento in arrivo', v_oggi - interval '86 days'),
    (v_azienda, v_c[12], null,'OL-2026-9002','app','ordinato',
      jsonb_build_array(jsonb_build_object('prodotto_id', v_lac2,'descrizione','Oasys 1-Day x30','occhio',null,'quantita',2,'prezzo',32,'parametri', jsonb_build_object('sfero',-1.75))), 64, 0, v_oggi + 2, null, null, v_oggi - interval '1 day'),
    (v_azienda, v_c[7], null,'OL-2026-9003','banco','arrivato',
      jsonb_build_array(jsonb_build_object('prodotto_id', v_lac2,'descrizione','Oasys 1-Day x30','occhio',null,'quantita',1,'prezzo',32,'parametri', jsonb_build_object('sfero',-3.00))), 32, 0, v_oggi - 1, null, 'da avvisare', v_oggi - interval '4 days');

  insert into public.movimenti_magazzino (azienda_id, prodotto_id, utente_id, tipo, quantita, riferimento)
  values (v_azienda, v_lac1, v_utente, 'scarico', -4, 'OL-2026-9001');

  -- ──────────────────────────────────────────────────────────────────────
  -- AGENDA e FERMI (uno scaduto: il disponibile eroso si deve VEDERE)
  -- ──────────────────────────────────────────────────────────────────────
  insert into public.appuntamenti (azienda_id, cliente_id, utente_id, tipo, inizio, durata_minuti, stato, riferimento, note)
  values
    (v_azienda, v_c[5], v_utente, 'controllo_vista', v_oggi + interval '1 day' + time '10:00', 30, 'prenotato', null, null),
    (v_azienda, v_c[10],v_utente, 'consegna',        v_oggi + interval '2 days' + time '17:30', 15, 'prenotato', 'BL-2026-9003', null),
    (v_azienda, v_c[2], v_utente, 'controllo_vista', v_oggi - interval '20 days' + time '11:00', 30, 'completato', null, null),
    (v_azienda, v_c[9], v_utente, 'altro',           v_oggi - interval '3 days' + time '16:00', 15, 'mancato', null, null);

  insert into public.fermi (azienda_id, prodotto_id, cliente_id, utente_id, quantita, stato, scade_il, note)
  values
    (v_azienda, v_mont1, v_c[7],  v_utente, 1, 'attivo', v_oggi + 3, 'fermo in corso'),
    (v_azienda, v_mont1, v_c[14], v_utente, 1, 'attivo', v_oggi - 4, 'fermo SCADUTO');

  -- ──────────────────────────────────────────────────────────────────────
  -- CASSA — vendite di oggi e di ieri, un reso, movimenti, l'incamero
  -- ──────────────────────────────────────────────────────────────────────
  insert into public.vendite (azienda_id, numero, cliente_id, utente_id, righe, pagamenti, totale, iva_totale, doc_numero, doc_data, cf_cliente, origine, data_vendita, stato, note)
  values
    (v_azienda,'VE-2026-9001', null,  v_utente,
      '[{"descrizione":"RB2140 Wayfarer G-15","quantita":1,"prezzo_unitario":158,"sconto":0,"aliquota":"22","dm":true}]',
      '[{"nome":"Contanti","importo":158}]', 158, 28.49, '1401-0003', v_oggi, null, 'cassa', now() - interval '3 hours','emessa','vendita veloce'),
    (v_azienda,'VE-2026-9002', v_c[3], v_utente,
      '[{"descrizione":"Opti-Free 300ml","quantita":2,"prezzo_unitario":12,"sconto":0,"aliquota":"22","dm":true}]',
      '[{"nome":"Bancomat","importo":24}]', 24, 4.33, '1401-0004', v_oggi, 'MRTLCU92P03F205X', 'cassa', now() - interval '1 hour','emessa',null),
    (v_azienda,'VE-2026-9003', v_c[13],v_utente,
      '[{"descrizione":"Occhiale completo — riparazione e lenti","quantita":1,"prezzo_unitario":300,"sconto":0,"aliquota":"4","dm":true}]',
      '[{"nome":"Mastercard","importo":300}]', 300, 11.54, '1400-0007', v_oggi - 1, null, 'cassa', now() - interval '1 day','emessa','ieri');

  insert into public.resi (azienda_id, vendita_id, cliente_id, utente_id, numero, tipo, causale, importo, metodo_rimborso, doc_numero, doc_data, note)
  values (v_azienda, (select id from public.vendite where numero='VE-2026-9003' and azienda_id=v_azienda), v_c[13], v_utente,
          'RE-2026-9001','denaro','soddisfatti_rimborsati', 60, 'Contanti', '1401-0001', v_oggi, 'reso parziale di ieri');

  insert into public.movimenti_cassa (azienda_id, utente_id, tipo, importo, motivo, riferimento)
  values
    (v_azienda, v_utente, 'prelievo', 20, 'francobolli e cancelleria', null),
    (v_azienda, v_utente, 'spesa',    15, 'panno microfibra scorta', 'scontrino cartoleria'),
    (v_azienda, v_utente, 'incamero_caparra', 150, 'mancato ritiro', 'BL-2026-9006');

  -- ──────────────────────────────────────────────────────────────────────
  -- CONTATORI — la serie 9xxx non deve scontrarsi coi numeri veri
  -- ──────────────────────────────────────────────────────────────────────
  insert into public.contatori (azienda_id, chiave, valore)
  values (v_azienda,'BL-2026',9006),(v_azienda,'OL-2026',9003),(v_azienda,'VE-2026',9003),(v_azienda,'RE-2026',9001)
  on conflict (azienda_id, chiave) do update set valore = greatest(public.contatori.valore, excluded.valore);

  raise notice 'SEED completato: 24 prodotti (giacenze via movimenti), 14 clienti, 8 prescrizioni, 6 buste, 3 ordini LAC, 4 appuntamenti, 2 fermi, 3 vendite, 1 reso, 3 movimenti di cassa.';
end $$;

-- Fine. Questi dati restano: sono la base del collaudo e si trattano da veri.
