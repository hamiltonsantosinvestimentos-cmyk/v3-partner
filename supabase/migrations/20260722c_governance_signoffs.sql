-- Aceite formal de sign-off (LGPD, compliance, decisões de governança).
-- Reaproveita o mesmo padrão de auditoria já usado em nda_signatures
-- (signed_at, ip_address, user_agent), generalizado para qualquer pedido
-- de aprovação que hoje só existe por email/verbal, sem registro rastreável.

CREATE TABLE IF NOT EXISTS governance_signoffs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT UNIQUE NOT NULL,
  subject           TEXT NOT NULL,
  description       TEXT NOT NULL,
  requested_by      UUID REFERENCES profiles(id),
  requested_of_name TEXT NOT NULL,
  requested_of_email TEXT NOT NULL,
  decision          TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
  decision_note     TEXT,
  decided_at        TIMESTAMPTZ,
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_governance_signoffs_updated_at ON governance_signoffs;
CREATE TRIGGER trg_governance_signoffs_updated_at
  BEFORE UPDATE ON governance_signoffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE governance_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_signoffs_admin_all" ON governance_signoffs
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

CREATE INDEX IF NOT EXISTS idx_governance_signoffs_token ON governance_signoffs(token);

-- Rollback:
-- DROP TABLE IF EXISTS governance_signoffs CASCADE;
