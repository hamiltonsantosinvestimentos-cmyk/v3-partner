-- Tabela de links M&A de captação
CREATE TABLE IF NOT EXISTS ma_captacao_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL,
  partner_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS ma_captacao_links_partner_id_idx ON ma_captacao_links(partner_id);
CREATE INDEX IF NOT EXISTS ma_captacao_links_token_idx ON ma_captacao_links(token);

-- RLS
ALTER TABLE ma_captacao_links ENABLE ROW LEVEL SECURITY;

-- Partners veem apenas os próprios links
CREATE POLICY "partner_own_ma_links" ON ma_captacao_links
  FOR ALL
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- Admin/Gestao veem todos
CREATE POLICY "admin_all_ma_links" ON ma_captacao_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'GESTAO')
    )
  );
