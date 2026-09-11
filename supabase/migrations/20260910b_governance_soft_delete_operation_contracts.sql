-- ============================================================
-- MIGRATION: Exclusao com lixeira (30 dias) + gate de governanca
-- Date: 2026-09-10
-- Scope: replica em operation_contracts o mesmo padrao ja em producao em
--        ma_deals/credit_desk_proposals/consorcio_cartas
--        (20260719_governance_soft_delete_ma_credito_consorcio.sql),
--        cm_asset_listings (20260705_cm_asset_soft_delete_governance.sql)
--        e crm_leads/operational_tickets (20260905_governance_soft_delete_crm_tickets.sql).
--
-- Contexto: Joao reportou nao ter como apagar rascunhos de contrato antigos
-- (gerados manualmente em teste) na Central de Contratos -- investigacao
-- confirmou que a tabela nunca recebeu esse padrao (unico ponto do sistema
-- que ficou de fora ate hoje). Guarda extra em relacao as outras tabelas:
-- exclusao so e permitida com status_signature = 'rascunho' (aplicada na
-- rota, nao aqui -- contrato enviado/assinado via ClickSign nunca pode ser
-- apagado por aqui, precisa ser cancelado no provedor primeiro).
-- ============================================================

ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT 'none';
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deletion_requested_by uuid REFERENCES profiles(id);
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

ALTER TABLE operation_contracts DROP CONSTRAINT IF EXISTS operation_contracts_deletion_status_check;
ALTER TABLE operation_contracts ADD CONSTRAINT operation_contracts_deletion_status_check
  CHECK (deletion_status IN ('none','pending_governance','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_operation_contracts_deleted_at
  ON operation_contracts(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN operation_contracts.deleted_at IS 'Soft delete: quando preenchido, contrato some da Central de Contratos mas fica na Lixeira por 30 dias. Rota /api/contracts/[id]/delete só permite com status_signature=rascunho.';
