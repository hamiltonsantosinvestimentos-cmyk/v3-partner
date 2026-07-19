-- ============================================================
-- MIGRATION: Exclusao com lixeira (30 dias) + gate de governanca
-- Date: 2026-07-19
-- Scope: replica em ma_deals, credit_desk_proposals e consorcio_cartas o
--        mesmo padrao ja em producao em cm_asset_listings
--        (20260705_cm_asset_soft_delete_governance.sql)
-- Ja aplicada em producao via mcp__plugin_supabase_supabase__apply_migration
--
-- NOTA: consorcio_projetos e consorcio_leads NAO existem como tabelas reais
-- (verificado via list_tables) — apenas consorcio_cartas e real. As rotas
-- de exclusao para projetos/leads foram removidas do escopo desta feature;
-- o Kanban de "leads" da Mesa de Consorcio ja busca uma tabela inexistente
-- hoje (bug pre-existente, fora do escopo desta migration).
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ma_deals', 'credit_desk_proposals', 'consorcio_cartas']
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

COMMENT ON COLUMN ma_deals.deleted_at IS 'Soft delete — quando preenchido, deal some do Kanban mas fica na Lixeira por 30 dias.';
COMMENT ON COLUMN credit_desk_proposals.deleted_at IS 'Soft delete — quando preenchido, proposta some da Mesa de Credito mas fica na Lixeira por 30 dias.';
COMMENT ON COLUMN consorcio_cartas.deleted_at IS 'Soft delete — quando preenchido, carta some da Mesa de Consorcio mas fica na Lixeira por 30 dias.';
