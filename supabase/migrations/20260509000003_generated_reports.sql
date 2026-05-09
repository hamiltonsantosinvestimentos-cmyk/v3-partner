-- Migration: relatórios gerados pelos squads de IA
-- 2026-05-09

BEGIN;

CREATE TABLE IF NOT EXISTS generated_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES agent_sessions(id),
  squad_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  html        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_reports_user ON generated_reports(user_id, created_at DESC);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Qualquer membro autenticado pode ler todos os relatórios gerados
CREATE POLICY "generated_reports_read"
  ON generated_reports FOR SELECT
  TO authenticated
  USING (true);

-- Apenas o criador pode inserir
CREATE POLICY "generated_reports_insert"
  ON generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE generated_reports IS
  'Relatórios HTML gerados pelos squads de IA (/agentes). Exibidos em /relatorios.';

COMMIT;
