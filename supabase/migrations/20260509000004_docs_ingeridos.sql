-- Migration: W3 Ingestao de Docs — V3 Partners
-- Fonte da verdade para todos os documentos ingeridos via n8n
-- Obsidian wiki e V3 Central sao outputs derivados, nao destinos primarios
-- Generated: 2026-05-09

BEGIN;

-- ============================================================
-- TABLE: docs_ingeridos
-- ============================================================
CREATE TABLE IF NOT EXISTS docs_ingeridos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificacao do arquivo
  arquivo_nome     TEXT NOT NULL,
  arquivo_path     TEXT,
  arquivo_tipo     TEXT NOT NULL, -- pdf, txt, md, docx
  hash_arquivo     TEXT NOT NULL UNIQUE, -- SHA-256 para deduplicacao

  -- Origem
  origem           TEXT NOT NULL DEFAULT 'raw_folder',
  -- raw_folder | portal | email

  -- Extracao pelo Claude
  resumo           TEXT,
  dados_extraidos  JSONB,
  -- {
  --   categoria: juridico|financeiro|ma_deals|comercial|operacional|outro
  --   tipo_documento: contrato|nda|cim|teaser|proposta|relatorio|memo|outro
  --   partes: string[]
  --   data_documento: YYYY-MM-DD
  --   valor_estimado: number
  --   palavras_chave: string[]
  --   observacoes: string
  -- }
  conteudo_extraido TEXT, -- texto bruto (base para busca futura + pgvector)

  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'novo',
  -- novo | processando | processado | erro
  erro_msg         TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: updated_at (reutiliza funcao do W2)
-- ============================================================
DROP TRIGGER IF EXISTS trg_docs_ingeridos_updated_at ON docs_ingeridos;
CREATE TRIGGER trg_docs_ingeridos_updated_at
  BEFORE UPDATE ON docs_ingeridos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
-- Deduplicacao por hash — consulta antes de processar
CREATE INDEX IF NOT EXISTS idx_docs_hash
  ON docs_ingeridos(hash_arquivo);

-- Filtro por status para reprocessamento e monitoramento
CREATE INDEX IF NOT EXISTS idx_docs_status
  ON docs_ingeridos(status, created_at DESC);

-- Busca por categoria dentro do JSONB
CREATE INDEX IF NOT EXISTS idx_docs_categoria
  ON docs_ingeridos((dados_extraidos->>'categoria'), created_at DESC);

-- Timeline
CREATE INDEX IF NOT EXISTS idx_docs_created
  ON docs_ingeridos(created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE docs_ingeridos ENABLE ROW LEVEL SECURITY;

-- n8n usa service_role → bypassa RLS por design Supabase
-- Equipe autenticada pode ler todos os docs
CREATE POLICY "docs_authenticated_read"
  ON docs_ingeridos FOR SELECT
  TO authenticated
  USING (true);

-- Portal pode inserir (upload direto futuramente)
CREATE POLICY "docs_authenticated_insert"
  ON docs_ingeridos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Equipe pode atualizar status e dados extraidos
CREATE POLICY "docs_authenticated_update"
  ON docs_ingeridos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE docs_ingeridos IS
  'Fonte da verdade para documentos ingeridos via W3 (n8n). '
  'Obsidian wiki e V3 Central sao outputs derivados gerados pos-insercao.';

COMMENT ON COLUMN docs_ingeridos.hash_arquivo IS
  'SHA-256 do arquivo original. Impede reprocessamento de duplicatas.';

COMMENT ON COLUMN docs_ingeridos.dados_extraidos IS
  'JSON flexivel com campos extraidos pelo Claude: categoria, tipo_documento, '
  'partes, data_documento, valor_estimado, palavras_chave, observacoes.';

COMMENT ON COLUMN docs_ingeridos.conteudo_extraido IS
  'Texto bruto extraido. Base para busca semantica com pgvector (fase futura).';

COMMIT;
