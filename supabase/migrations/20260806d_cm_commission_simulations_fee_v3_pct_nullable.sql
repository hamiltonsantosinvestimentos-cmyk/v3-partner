-- ============================================================
-- MIGRATION: Corrige NOT NULL orfao em fee_v3_pct (P0)
-- Date: 2026-08-06
-- Scope: fee_v3_pct era NOT NULL desde a Fase 1 (20260806_cm_commission_
--        simulations.sql). A partir da Fase 3, o payload de insert passou
--        a gravar fee_v3_buy_pct/fee_v3_sell_pct (por lado) e parou de
--        enviar fee_v3_pct, mas a coluna nunca foi migrada para nullable,
--        entao TODO clique em "Salvar Simulacao" desde a Fase 3 falhava com
--        "null value in column fee_v3_pct violates not-null constraint".
--        Achado ao vivo por Joao. A Fase 3 ja tinha marcado a coluna como
--        obsoleta via COMMENT ON, mas obsoleta != nullable.
-- Rollback: supabase/rollbacks/20260806d_cm_commission_simulations_fee_v3_pct_nullable_rollback.sql
--        (o rollback NAO restaura NOT NULL de proposito, ver nota no arquivo)
-- ============================================================

ALTER TABLE cm_commission_simulations
  ALTER COLUMN fee_v3_pct DROP NOT NULL;

COMMENT ON COLUMN cm_commission_simulations.fee_v3_pct IS 'OBSOLETA a partir da Fase 3 (06/08/2026): era a fatia global da V3, repartida proporcionalmente entre os lados. Substituida por fee_v3_buy_pct/fee_v3_sell_pct, independentes por lado. Coluna preservada, nunca mais escrita. Nullable desde 06/08/2026 (fix do bug P0 que travava todo Salvar Simulacao).';
