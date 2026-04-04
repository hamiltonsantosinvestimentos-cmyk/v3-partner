-- ============================================================
-- Sprint 5: Metas de Partners
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year            int  NOT NULL,
  month           int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  goal_proposals  int  NOT NULL DEFAULT 0,   -- meta de propostas submetidas
  goal_approvals  int  NOT NULL DEFAULT 0,   -- meta de aprovações
  goal_volume     numeric(18,2) NOT NULL DEFAULT 0, -- meta de volume (R$)
  goal_deals      int  NOT NULL DEFAULT 0,   -- meta de deals M&A fechados
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_partner_goals_partner ON partner_goals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_goals_period  ON partner_goals(year, month);

ALTER TABLE partner_goals ENABLE ROW LEVEL SECURITY;

-- Partner vê suas próprias metas; Admin/Gestao vê todas
CREATE POLICY "read_partner_goals"
  ON partner_goals FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  );

-- Somente ADMIN/GESTAO define metas
CREATE POLICY "admin_write_partner_goals"
  ON partner_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN','GESTAO')
    )
  );
