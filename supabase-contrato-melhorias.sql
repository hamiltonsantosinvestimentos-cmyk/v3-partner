-- Melhorias do Contrato de Mandato
-- Executar no Supabase SQL Editor

ALTER TABLE contratos_mandato
  ADD COLUMN IF NOT EXISTS contrato_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS client_doc_url    TEXT;
