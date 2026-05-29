-- Migration: 20260529000002_deal_upload_tokens
-- Feature: Links de upload descentralizado para terceiros (parceiros, contadores, jurídico)

-- ─── Tokens de upload ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_upload_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
  partner_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label       TEXT,                                       -- ex: "Contador João Silva"
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  max_uses    INT NOT NULL DEFAULT 20,
  used_count  INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'expired', 'revoked')),
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_deal_upload_tokens_updated_at ON deal_upload_tokens;
CREATE TRIGGER trg_deal_upload_tokens_updated_at
  BEFORE UPDATE ON deal_upload_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deal_upload_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_tokens_admin_gestao" ON deal_upload_tokens;
CREATE POLICY "upload_tokens_admin_gestao" ON deal_upload_tokens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role])
  ));

-- ─── Audit log de uploads via token ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_upload_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     UUID NOT NULL REFERENCES deal_upload_tokens(id) ON DELETE CASCADE,
  deal_id      UUID NOT NULL,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size    BIGINT,
  file_hash    TEXT,       -- SHA-256 do arquivo
  mime_type    TEXT,
  ip_address   TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deal_upload_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_audit_admin_gestao" ON deal_upload_audit;
CREATE POLICY "upload_audit_admin_gestao" ON deal_upload_audit
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role])
  ));

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_upload_tokens_deal    ON deal_upload_tokens(deal_id);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token   ON deal_upload_tokens(token) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_upload_audit_token    ON deal_upload_audit(token_id, uploaded_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS deal_upload_audit;
-- DROP TABLE IF EXISTS deal_upload_tokens;
