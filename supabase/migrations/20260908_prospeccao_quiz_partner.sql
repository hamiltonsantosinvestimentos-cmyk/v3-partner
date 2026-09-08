-- Quiz "Seja Partner" (/seja-partner) — grava lead qualificado em prospeccao_leads.
-- Colunas novas, todas nullable / com default → backward compatible.

ALTER TABLE prospeccao_leads
  ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score          INT,
  ADD COLUMN IF NOT EXISTS plano_sugerido TEXT;

COMMENT ON COLUMN prospeccao_leads.metadata       IS 'Respostas estruturadas do quiz + breakdown do score (form_type: quiz_partner)';
COMMENT ON COLUMN prospeccao_leads.score          IS 'Score de qualificação 0-110 calculado no servidor pelo quiz';
COMMENT ON COLUMN prospeccao_leads.plano_sugerido IS 'Plano recomendado pelo quiz: STARTER | PARTNER | PARTNER_PRO | ENTERPRISE';

CREATE INDEX IF NOT EXISTS idx_prospeccao_leads_score ON prospeccao_leads(score);
