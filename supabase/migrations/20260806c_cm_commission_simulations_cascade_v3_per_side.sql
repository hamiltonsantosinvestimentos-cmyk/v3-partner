-- ============================================================
-- MIGRATION: Calculadora Rapida Fase 3 (cascata top-down, V3 por
--            lado, sem trava de soma 100%)
-- Date: 2026-08-06
-- Scope: a Fase 2 tinha fee_v3_pct como um numero global, repartido
--        proporcionalmente entre os lados so para exibicao. A Fase 3
--        torna a Taxa de Estruturacao V3 um input MANUAL e
--        INDEPENDENTE por lado (Compra e Venda deixam de compartilhar
--        a mesma fatia da V3). As 2 colunas novas guardam o que foi
--        digitado; fee_v3_pct (Fase 1/2) fica na tabela mas para de
--        ser escrita a partir desta revisao, nunca removida (nenhuma
--        linha real dependia dela, tabela confirmada vazia).
-- Rollback: supabase/rollbacks/20260806c_cm_commission_simulations_cascade_v3_per_side_rollback.sql
-- ============================================================

ALTER TABLE cm_commission_simulations
  ADD COLUMN IF NOT EXISTS fee_v3_buy_pct numeric,
  ADD COLUMN IF NOT EXISTS fee_v3_sell_pct numeric;

COMMENT ON COLUMN cm_commission_simulations.fee_v3_buy_pct IS 'Taxa de Estruturacao V3 do lado Compra, percentual da fatia bruta do lado. Manual por operacao, independente do lado Venda (Fase 3, cascata top-down).';
COMMENT ON COLUMN cm_commission_simulations.fee_v3_sell_pct IS 'Taxa de Estruturacao V3 do lado Venda, percentual da fatia bruta do lado. Manual por operacao, independente do lado Compra (Fase 3, cascata top-down).';
COMMENT ON COLUMN cm_commission_simulations.fee_v3_pct IS 'OBSOLETA a partir da Fase 3 (06/08/2026): era a fatia global da V3, repartida proporcionalmente entre os lados. Substituida por fee_v3_buy_pct/fee_v3_sell_pct, independentes por lado. Coluna preservada, nunca mais escrita.';
