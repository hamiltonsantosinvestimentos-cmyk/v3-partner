-- Migration: /agentes — histórico de sessões com squads de IA
-- 2026-05-09

BEGIN;

CREATE TYPE agent_export_type AS ENUM ('deal', 'relatorio', 'nenhum');

CREATE TABLE IF NOT EXISTS agent_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  squad_id     TEXT NOT NULL,
  title        TEXT,
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  export_type  agent_export_type DEFAULT 'nenhum',
  archived     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER trg_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_agent_sessions_user  ON agent_sessions(user_id, created_at DESC);
CREATE INDEX idx_agent_sessions_squad ON agent_sessions(user_id, squad_id, created_at DESC);

-- RLS
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_sessions_own"
  ON agent_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE agent_sessions IS
  'Histórico de conversas com squads de IA no portal /agentes.';

COMMIT;
