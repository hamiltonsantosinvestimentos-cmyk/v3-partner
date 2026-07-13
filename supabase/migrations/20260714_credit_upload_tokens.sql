-- Migration: 20260714_credit_upload_tokens
-- Feature: Link de upload de documentos para o cliente final de uma proposta
-- de crédito já em andamento na Mesa de Crédito (sem login), espelhando o
-- padrao ja existente em deal_upload_tokens/deal_upload_audit (Mesa M&A).

-- ─── Tokens de upload ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_upload_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES credit_desk_proposals(id) ON DELETE CASCADE,
  partner_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label       TEXT,                                       -- ex: "Cliente Maria Silva"
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  max_uses    INT NOT NULL DEFAULT 30,
  used_count  INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'expired', 'revoked')),
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_credit_upload_tokens_updated_at ON credit_upload_tokens;
CREATE TRIGGER trg_credit_upload_tokens_updated_at
  BEFORE UPDATE ON credit_upload_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE credit_upload_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_upload_tokens_mesa" ON credit_upload_tokens;
CREATE POLICY "credit_upload_tokens_mesa" ON credit_upload_tokens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])
  ));

-- ─── Audit log de uploads via token ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_upload_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     UUID NOT NULL REFERENCES credit_upload_tokens(id) ON DELETE CASCADE,
  proposal_id  UUID NOT NULL,
  doc_id       TEXT,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size    BIGINT,
  file_hash    TEXT,       -- SHA-256 do arquivo
  mime_type    TEXT,
  ip_address   TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_upload_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_upload_audit_mesa" ON credit_upload_audit;
CREATE POLICY "credit_upload_audit_mesa" ON credit_upload_audit
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'GESTAO'::user_role, 'MESA_OPERACIONAL'::user_role])
  ));

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_credit_upload_tokens_proposal ON credit_upload_tokens(proposal_id);
CREATE INDEX IF NOT EXISTS idx_credit_upload_tokens_token    ON credit_upload_tokens(token) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_upload_audit_token     ON credit_upload_audit(token_id, uploaded_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS credit_upload_audit;
-- DROP TABLE IF EXISTS credit_upload_tokens;
