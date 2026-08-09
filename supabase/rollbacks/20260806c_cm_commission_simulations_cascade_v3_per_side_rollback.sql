-- ROLLBACK: Calculadora Rapida Fase 3 (V3 por lado)
-- Referente a: supabase/migrations/20260806c_cm_commission_simulations_cascade_v3_per_side.sql
-- Reversivel 100%, so remove as 2 colunas novas, nunca toca no restante da tabela.

ALTER TABLE cm_commission_simulations
  DROP COLUMN IF EXISTS fee_v3_buy_pct,
  DROP COLUMN IF EXISTS fee_v3_sell_pct;
