# RV-01 · La regola dei vincoli: allargare sì, stringere no

*12/08/2026, su fermata-2 di Manus in B2*

1. I VINCOLI (check, not null, unique/indici) non sono colonne: «additive-only · mai drop» protegge DATI e NOMI, non le regole di ammissibilità. Un vincolo si può SOSTITUIRE solo se il nuovo è **uguale o più largo**: ogni riga e ogni scrittura valida prima resta valida dopo. STRINGERE è vietato in corsa (solo busta dedicata + verifica dati + decisione di regia).
2. Meccanica obbligatoria: `drop constraint` + `add constraint` nella **stessa transazione**; nome versionato (`chk_..._v2`); commento SQL sul vincolo con migrazione e motivo.
3. Ogni sostituzione porta il **test di non-regressione del dominio**: (a) i valori vecchi passano ancora, (b) i nuovi passano, (c) un fuori-dominio fallisce. E la riga nei tre-pezzi: «vincoli allargati: elenco».
4. NOT NULL: allentare = lecito (precedente C1, telefono); aggiungerlo su colonna esistente = stringere → vietato in corsa.
5. UNIQUE/indici: sostituire con più largo (es. parziale — precedente `uq_persone_telefono_reale`) = lecito; più stretto = stringere.
6. COLONNE PARALLELE: mai come default (doppia verità, drift). Riservate ai soli casi in cui cambia la SEMANTICA, non il dominio — decise per nome dalla regia.
