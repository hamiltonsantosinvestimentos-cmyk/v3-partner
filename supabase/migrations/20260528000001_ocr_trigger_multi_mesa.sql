-- OCR Trigger Multi-Mesa: campos para suportar /api/ocr/trigger
-- Permite que todas as mesas (M&A, Crédito N1/N2/N3, Consórcio) usem W9

ALTER TABLE ma_document_extractions
  ADD COLUMN IF NOT EXISTS file_name    TEXT,
  ADD COLUMN IF NOT EXISTS source_type  TEXT DEFAULT 'ma',
  ADD COLUMN IF NOT EXISTS source_id    UUID;

-- Índice para polling rápido por status (todas as mesas)
CREATE INDEX IF NOT EXISTS idx_doc_extractions_source
  ON ma_document_extractions(source_type, source_id)
  WHERE source_id IS NOT NULL;

-- Comentário de contexto
COMMENT ON COLUMN ma_document_extractions.source_type
  IS 'Origem da extração: ma | credit | consorcio';

COMMENT ON COLUMN ma_document_extractions.source_id
  IS 'ID da entidade de origem (deal_id, proposal_id, etc.)';

-- Rollback: DROP COLUMN IF EXISTS file_name, source_type, source_id
