-- Rollback: W2 Intake de Deals
-- Executar APENAS se precisar reverter a migration 20260502000001

BEGIN;

DROP TABLE IF EXISTS deal_intakes;
DROP TYPE IF EXISTS status_intake;
DROP TYPE IF EXISTS origem_lead_v3;
DROP TYPE IF EXISTS tipo_operacao_v3;
DROP TYPE IF EXISTS setor_v3;
DROP FUNCTION IF EXISTS set_updated_at();

COMMIT;
