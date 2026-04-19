-- Roda no SQL Editor do Supabase
-- Tabela de links de captação vinculados a partners

CREATE TABLE IF NOT EXISTS captacao_links (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token        TEXT UNIQUE NOT NULL,
  partner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  uses_count   INTEGER DEFAULT 0,
  active       BOOLEAN DEFAULT TRUE
);

-- Coluna metadata em crm_leads (dados completos do formulário do cliente)
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- RLS: partner vê seus próprios links; service role acessa tudo
ALTER TABLE captacao_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "captacao_partner_own" ON captacao_links
  FOR ALL USING (partner_id = auth.uid());
