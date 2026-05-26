-- Adiciona partner_id e campos de confirmação humana a ma_document_extractions

ALTER TABLE ma_document_extractions
  ADD COLUMN IF NOT EXISTS partner_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ma_doc_extractions_deal_id
  ON ma_document_extractions(deal_id);

CREATE INDEX IF NOT EXISTS idx_ma_doc_extractions_partner_id
  ON ma_document_extractions(partner_id);
