-- Migration: commercial_proposals + proposal_messages
-- Módulo Propostas Comerciais V3 Partners
-- LGPD: base legal Art. 7 V (execução contratual) — autorizado Robson Lino 2026-05-31

CREATE TABLE IF NOT EXISTS commercial_proposals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT        NOT NULL,
  title              TEXT        NOT NULL,
  service_type       TEXT        NOT NULL DEFAULT 'outro',
  status             TEXT        NOT NULL DEFAULT 'draft',
  created_by         UUID        NOT NULL REFERENCES profiles(id),
  partner_id         UUID        REFERENCES profiles(id),
  partner_name       TEXT,
  partner_email      TEXT,
  recipient_name     TEXT        NOT NULL,
  recipient_email    TEXT        NOT NULL,
  recipient_company  TEXT,
  value              NUMERIC,
  description        TEXT,
  deal_id            UUID        REFERENCES ma_deals(id),
  clicksign_key      TEXT,
  clicksign_url      TEXT,
  sent_at            TIMESTAMPTZ,
  viewed_at          TIMESTAMPTZ,
  signed_at          TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  metadata           JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID        NOT NULL REFERENCES commercial_proposals(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES profiles(id),
  sender_name  TEXT        NOT NULL,
  sender_role  TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'internal_note',
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers
DROP TRIGGER IF EXISTS trg_commercial_proposals_updated_at ON commercial_proposals;
CREATE TRIGGER trg_commercial_proposals_updated_at
  BEFORE UPDATE ON commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE commercial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_messages    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_mesa_all" ON commercial_proposals
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

CREATE POLICY "proposal_messages_mesa_all" ON proposal_messages
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_created_by ON commercial_proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_status     ON commercial_proposals(status);
CREATE INDEX IF NOT EXISTS idx_commercial_proposals_deal_id    ON commercial_proposals(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_messages_proposal_id   ON proposal_messages(proposal_id);

-- Rollback:
-- DROP TABLE IF EXISTS proposal_messages CASCADE;
-- DROP TABLE IF EXISTS commercial_proposals CASCADE;
