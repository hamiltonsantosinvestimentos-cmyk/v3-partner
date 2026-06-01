-- ============================================================
-- Migration: WhatsApp Audio Intel — V3 Partners
-- Data: 2026-06-01
-- Feature: Extração de contexto de áudios WhatsApp → deal_intakes
-- LGPD: Aprovado Robson Lino (2026-06-01) — base legal Art.7 inc.V
-- Nota: armazenar apenas transcrição em texto, nunca arquivo de áudio bruto
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ENUMS — adicionar novos valores (idempotente com IF NOT EXISTS)
-- ============================================================

-- Novo canal de origem para intakes via WhatsApp
ALTER TYPE origem_lead_v3 ADD VALUE IF NOT EXISTS 'whatsapp_audio';

-- Vertical indefinida para áudios sem contexto claro de negócio
ALTER TYPE setor_v3 ADD VALUE IF NOT EXISTS 'outro';

-- Commit parcial obrigatório após ADD VALUE (PostgreSQL exige)
COMMIT;
BEGIN;

-- ============================================================
-- 2. TABELA NOVA: whatsapp_audio_extractions
-- Armazena transcrição + extração estruturada de cada áudio
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_audio_extractions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação da mensagem WhatsApp
  whatsapp_message_id TEXT NOT NULL,
  sender_phone        TEXT NOT NULL,
  sender_name         TEXT,               -- nullable: nem sempre disponível

  -- Áudio
  audio_duration_s    INTEGER,            -- duração em segundos

  -- Transcrição (Whisper)
  transcription       TEXT,               -- texto transcrito — dado pessoal, retenção 90 dias

  -- Extração Claude Haiku
  extraction_raw      JSONB,              -- JSON completo retornado pelo Claude
  vertical_detected   TEXT,              -- M&A | REAL_ESTATE | MINERACAO | CREDITO | INDEFINIDO
  ticket_estimado     TEXT,              -- valor mencionado ou null
  urgencia            TEXT DEFAULT 'NORMAL',  -- ALTA | NORMAL | BAIXA
  resumo_executivo    TEXT,              -- 3 linhas para exibição no portal
  proximo_passo       TEXT,              -- ação sugerida para a Mesa

  -- Pipeline
  status              TEXT NOT NULL DEFAULT 'pending',
                                         -- pending | processing | done | failed
  n8n_execution_id    TEXT,              -- ID da execução n8n (debug)
  error_message       TEXT,              -- mensagem de erro se status = failed
  processed_at        TIMESTAMPTZ,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at (função já existe no banco)
DROP TRIGGER IF EXISTS trg_wae_updated_at ON whatsapp_audio_extractions;
CREATE TRIGGER trg_wae_updated_at
  BEFORE UPDATE ON whatsapp_audio_extractions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS obrigatório
ALTER TABLE whatsapp_audio_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wae_internal_only" ON whatsapp_audio_extractions
  FOR ALL TO authenticated
  USING (get_user_role() IN ('ADMIN', 'GESTAO', 'MESA', 'MESA_OPERACIONAL'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_wae_message_id
  ON whatsapp_audio_extractions(whatsapp_message_id);

CREATE INDEX IF NOT EXISTS idx_wae_status
  ON whatsapp_audio_extractions(status);

CREATE INDEX IF NOT EXISTS idx_wae_sender_phone
  ON whatsapp_audio_extractions(sender_phone);

CREATE INDEX IF NOT EXISTS idx_wae_created
  ON whatsapp_audio_extractions(created_at DESC);

COMMENT ON TABLE whatsapp_audio_extractions IS
  'Transcrições e extrações de áudios WhatsApp. '
  'LGPD: retenção máxima 90 dias. Nunca armazenar arquivo de áudio bruto. '
  'Aprovação Robson Lino 2026-06-01.';

COMMENT ON COLUMN whatsapp_audio_extractions.transcription IS
  'Texto transcrito pelo Whisper. Dado pessoal — política de retenção 90 dias.';

-- ============================================================
-- 3. deal_intakes — colunas novas (nullable, backward compatible)
-- ============================================================

-- FK para o registro de áudio que originou este intake
ALTER TABLE deal_intakes
  ADD COLUMN IF NOT EXISTS audio_extraction_id UUID
    REFERENCES whatsapp_audio_extractions(id),
  ADD COLUMN IF NOT EXISTS origem_audio TEXT;
    -- 'whatsapp' quando intake veio de áudio, null caso contrário

-- Índice para busca por audio_extraction_id
CREATE INDEX IF NOT EXISTS idx_deal_intakes_audio
  ON deal_intakes(audio_extraction_id)
  WHERE audio_extraction_id IS NOT NULL;

COMMENT ON COLUMN deal_intakes.audio_extraction_id IS
  'FK para whatsapp_audio_extractions. Preenchida apenas em intakes via áudio.';

COMMENT ON COLUMN deal_intakes.origem_audio IS
  'Canal de áudio de origem. Valor: whatsapp. Null para intakes via formulário (W2).';

-- ============================================================
-- Notas de implementação para o n8n W12
-- ============================================================
--
-- Campos NOT NULL em deal_intakes que o W12 deve preencher:
--
--   empresa_nome    → sender_name ?? 'Lead WhatsApp ' || sender_phone
--   setor           → mapeamento: M&A→ma_cross_border, REAL_ESTATE→real_estate,
--                     MINERACAO→mineracao_commodities, CREDITO→credito_recebiveis,
--                     INDEFINIDO→outro
--   valor_estimado  → parse do ticket_estimado se disponível,
--                     caso contrário usar 500000 (mínimo do sistema)
--                     A Mesa atualiza durante qualificação.
--   tipo_operacao   → 'captacao' como default para intakes via áudio
--   contato_nome    → sender_name ?? sender_phone
--   origem_lead     → 'whatsapp_audio' (novo valor adicionado acima)
--
-- ============================================================

COMMIT;

-- ============================================================
-- ROLLBACK (executar manualmente se necessário)
-- ============================================================
-- ALTER TABLE deal_intakes DROP COLUMN IF EXISTS audio_extraction_id;
-- ALTER TABLE deal_intakes DROP COLUMN IF EXISTS origem_audio;
-- DROP TABLE IF EXISTS whatsapp_audio_extractions CASCADE;
-- (enum values não podem ser removidos no PostgreSQL sem recriar o tipo)
-- ============================================================
