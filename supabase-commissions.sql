-- ============================================================
-- Sprint 4: Tabela de Comissões
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS commissions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text UNIQUE NOT NULL,
  partner_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type           text NOT NULL CHECK (operation_type IN ('CREDITO','MA','CONSORCIO','SPLIT_FISCAL')),
  operation_id             uuid,
  operation_code           text,
  operation_description    text NOT NULL,
  operation_value          numeric(18,2) NOT NULL DEFAULT 0,
  commission_percent       numeric(5,2) NOT NULL DEFAULT 0,
  commission_value         numeric(18,2) GENERATED ALWAYS AS (operation_value * commission_percent / 100) STORED,
  status                   text NOT NULL DEFAULT 'A_PAGAR' CHECK (status IN ('A_PAGAR','PAGA','CANCELADA')),
  operation_closed_at      date,
  payment_date             date,
  notes                    text,
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_partner_id  ON commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status      ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at  ON commissions(created_at DESC);

-- RLS
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Partner vê apenas as suas; Admin/Financeiro/Gestao vê todas
CREATE POLICY "partner_read_own_commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO','FINANCEIRO')
    )
  );

-- Somente ADMIN/GESTAO/FINANCEIRO inserem e atualizam
CREATE POLICY "admin_write_commissions"
  ON commissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO','FINANCEIRO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO','FINANCEIRO')
    )
  );
