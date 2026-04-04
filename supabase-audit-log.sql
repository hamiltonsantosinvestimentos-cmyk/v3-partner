-- ============================================================
-- Sprint 3: Tabela de Audit Log
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   text,
  action      text NOT NULL,          -- CREATE | UPDATE | DELETE
  entity      text NOT NULL,          -- ma_deals | tickets | credit_proposals | split_fiscal
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas ADMIN/GESTAO podem ler logs
CREATE POLICY "admin_read_audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'GESTAO')
    )
  );

-- Ninguém insere diretamente via RLS — inserção sempre via service role
CREATE POLICY "service_insert_audit_logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
