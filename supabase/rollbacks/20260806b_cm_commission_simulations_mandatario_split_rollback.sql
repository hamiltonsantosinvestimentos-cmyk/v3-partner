-- ROLLBACK: Calculadora Rapida Fase 2 (Mandatario/Titular por lado)
-- Referente a: supabase/migrations/20260806b_cm_commission_simulations_mandatario_split.sql
-- Reversivel 100%, so remove as 4 colunas novas, nunca toca na tabela em si.

ALTER TABLE cm_commission_simulations
  DROP COLUMN IF EXISTS buy_mandatario_input_value,
  DROP COLUMN IF EXISTS buy_mandatario_input_unit,
  DROP COLUMN IF EXISTS sell_mandatario_input_value,
  DROP COLUMN IF EXISTS sell_mandatario_input_unit;
