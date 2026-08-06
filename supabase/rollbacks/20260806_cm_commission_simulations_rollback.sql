-- ROLLBACK: Calculadora Rapida de Comissionamento (cm_commission_simulations)
-- Referente a: supabase/migrations/20260806_cm_commission_simulations.sql
-- Reversivel 100%, nao toca em nenhuma tabela existente.

DROP TRIGGER IF EXISTS trg_cm_commission_simulations_updated_at ON cm_commission_simulations;
DROP TABLE IF EXISTS cm_commission_simulations;
