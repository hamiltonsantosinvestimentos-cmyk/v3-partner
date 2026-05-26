-- Blindagem anti-duplicata em ma_document_extractions
-- Permite apenas UMA extração ativa por (deal_id, doc_id)
-- Re-extração só é liberada quando o status anterior é 'error'
CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_active_doc
  ON ma_document_extractions(deal_id, doc_id)
  WHERE status NOT IN ('error');
