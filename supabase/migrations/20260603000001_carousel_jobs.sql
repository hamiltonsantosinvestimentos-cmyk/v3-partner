-- carousel_jobs: fila de produção automática de carrosséis
CREATE TABLE IF NOT EXISTS carousel_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Input
  url           TEXT NOT NULL,
  canal         TEXT NOT NULL DEFAULT 'joao',   -- joao | v3 | agro
  arquetipo     TEXT NOT NULL DEFAULT '04',
  hook_extra    TEXT,
  screenshot_path TEXT,   -- path local do screenshot (opcional)

  -- Status
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | error

  -- Output
  output_dir    TEXT,
  png_paths     TEXT[],
  caption_instagram TEXT,
  caption_linkedin  TEXT,
  slug          TEXT,
  error_msg     TEXT,

  -- Origem
  whatsapp_from TEXT,   -- número que disparou
  requested_by  TEXT DEFAULT 'joao'
);

CREATE INDEX idx_carousel_jobs_status ON carousel_jobs(status);
CREATE INDEX idx_carousel_jobs_created ON carousel_jobs(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_carousel_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER carousel_jobs_updated_at
  BEFORE UPDATE ON carousel_jobs
  FOR EACH ROW EXECUTE FUNCTION update_carousel_jobs_updated_at();

-- RLS
ALTER TABLE carousel_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON carousel_jobs FOR ALL TO service_role USING (true);
