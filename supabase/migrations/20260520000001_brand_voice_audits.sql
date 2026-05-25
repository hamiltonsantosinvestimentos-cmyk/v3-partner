-- Migration: brand_voice_audits
-- Brand Voice Gate — gate de conformidade de voz da marca V3 Partners

CREATE TABLE IF NOT EXISTS brand_voice_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_type    TEXT NOT NULL CHECK (context_type IN ('institucional', 'comunidade')),
  input_text      TEXT NOT NULL,
  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed          BOOLEAN NOT NULL GENERATED ALWAYS AS (score >= 70) STORED,
  archetype_match TEXT,
  issues          TEXT[],
  suggestions     TEXT[],
  overridden_by   UUID REFERENCES profiles(id),
  override_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger obrigatorio (funcao ja existe no projeto)
DROP TRIGGER IF EXISTS trg_brand_voice_audits_updated_at ON brand_voice_audits;
CREATE TRIGGER trg_brand_voice_audits_updated_at
  BEFORE UPDATE ON brand_voice_audits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS obrigatorio
ALTER TABLE brand_voice_audits ENABLE ROW LEVEL SECURITY;

-- ADMIN e GESTAO veem tudo
CREATE POLICY "brand_voice_admin_all" ON brand_voice_audits
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO'));

-- MESA_OPERACIONAL e PARTNER_PRO veem apenas os proprios registros
CREATE POLICY "brand_voice_own_select" ON brand_voice_audits
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('MESA_OPERACIONAL', 'PARTNER_PRO')
    AND user_id = auth.uid()
  );

CREATE POLICY "brand_voice_own_insert" ON brand_voice_audits
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('MESA_OPERACIONAL', 'PARTNER_PRO')
    AND user_id = auth.uid()
  );

-- Indices criticos
CREATE INDEX IF NOT EXISTS idx_bva_user_id ON brand_voice_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_bva_passed   ON brand_voice_audits(passed);
CREATE INDEX IF NOT EXISTS idx_bva_created  ON brand_voice_audits(created_at DESC);

-- ROLLBACK: DROP TABLE IF EXISTS brand_voice_audits CASCADE;
