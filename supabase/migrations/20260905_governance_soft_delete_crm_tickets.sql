-- ============================================================
-- MIGRATION: Exclusao com lixeira (30 dias) + gate de governanca
-- Date: 2026-09-05
-- Scope: replica em crm_leads e operational_tickets o mesmo padrao ja em
--        producao em ma_deals/credit_desk_proposals/consorcio_cartas
--        (20260719_governance_soft_delete_ma_credito_consorcio.sql) e,
--        antes disso, em cm_asset_listings
--        (20260705_cm_asset_soft_delete_governance.sql).
--
-- Contexto: pedido de Joao (via /crm) apontou que o botao "Excluir" no
-- CRM e nos tickets da Mesa Operacional apagava de verdade na hora (hard
-- delete, sem Lixeira, sem aviso a ninguem), unico ponto do sistema que
-- ainda nao tinha recebido esse padrao. crm_leads guarda CPF/CNPJ/contato
-- real de terceiros; decisao de trazer para o mesmo padrao foi confirmada
-- por Joao em 2026-09-05.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_leads', 'operational_tickets']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deletion_reason text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT ''none''', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deletion_requested_by uuid REFERENCES profiles(id)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz', t);

    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_deletion_status_check');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (deletion_status IN (''none'',''pending_governance'',''approved'',''rejected''))',
      t, t || '_deletion_status_check'
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(deleted_at) WHERE deleted_at IS NOT NULL',
      'idx_' || t || '_deleted_at', t
    );
  END LOOP;
END $$;

COMMENT ON COLUMN crm_leads.deleted_at IS 'Soft delete: quando preenchido, lead some do CRM mas fica na Lixeira por 30 dias.';
COMMENT ON COLUMN operational_tickets.deleted_at IS 'Soft delete: quando preenchido, ticket some da Mesa Operacional mas fica na Lixeira por 30 dias.';
