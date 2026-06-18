-- Migration: Módulo Mandato TEC (Taxa de Estruturação de Crédito)
-- Estende commercial_proposals + cria tec_acceptances

-- 1. Colunas TEC em commercial_proposals
ALTER TABLE commercial_proposals
  ADD COLUMN IF NOT EXISTS tec_percentage    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS fund_name         TEXT,
  ADD COLUMN IF NOT EXISTS meeting_link      TEXT,
  ADD COLUMN IF NOT EXISTS meeting_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deal_code_ref     TEXT;

CREATE INDEX IF NOT EXISTS idx_commercial_proposals_meeting_at
  ON commercial_proposals(meeting_at)
  WHERE meeting_at IS NOT NULL AND status IN ('sent', 'signed');

-- 2. Tabela tec_acceptances
CREATE TABLE IF NOT EXISTS tec_acceptances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id         UUID NOT NULL REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  token               UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  accepted_by         TEXT,
  accepted_email      TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  accepted_at         TIMESTAMPTZ,
  tec_percentage      NUMERIC(5,2) NOT NULL,
  penalty_clause      TEXT NOT NULL DEFAULT 'Multa de 2% sobre o valor da operação em caso de desistência após aceite formal.',
  negativation_clause TEXT NOT NULL DEFAULT 'Em caso de inadimplência superior a 30 dias, a V3 Partners reserva-se o direito de negativação nos órgãos competentes.',
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_tec_acceptances_updated_at ON tec_acceptances;
CREATE TRIGGER trg_tec_acceptances_updated_at
  BEFORE UPDATE ON tec_acceptances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tec_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_tec_acceptances" ON tec_acceptances
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL')
    )
  );

CREATE INDEX IF NOT EXISTS idx_tec_acceptances_proposal ON tec_acceptances(proposal_id);
CREATE INDEX IF NOT EXISTS idx_tec_acceptances_token ON tec_acceptances(token);
CREATE INDEX IF NOT EXISTS idx_tec_acceptances_status ON tec_acceptances(status);
