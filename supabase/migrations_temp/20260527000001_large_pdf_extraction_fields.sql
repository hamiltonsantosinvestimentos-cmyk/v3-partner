-- Large PDF OCR Pipeline — campos de rastreamento de processamento async
ALTER TABLE ma_document_extractions
  ADD COLUMN IF NOT EXISTS file_size_bytes   INTEGER,
  ADD COLUMN IF NOT EXISTS processing_mode   TEXT DEFAULT 'sync',
  ADD COLUMN IF NOT EXISTS anthropic_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_doc_extractions_anthropic_file
  ON ma_document_extractions(anthropic_file_id)
  WHERE anthropic_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_extractions_queued
  ON ma_document_extractions(status)
  WHERE status IN ('queued', 'processing');
