-- Complemento da migration 20260722: caminho do PDF gerado no bucket credit-documents.
-- Guardar o path (não a signed URL) permite gerar uma nova URL assinada a qualquer momento,
-- sem depender da validade da URL assinada no momento da geração.

ALTER TABLE partner_service_orders
  ADD COLUMN IF NOT EXISTS report_pdf_path TEXT;

COMMENT ON COLUMN partner_service_orders.report_pdf_path IS
  'Caminho do PDF do relatório final no bucket credit-documents. Usado para gerar signed URLs sob demanda.';

-- Rollback:
-- ALTER TABLE partner_service_orders DROP COLUMN IF EXISTS report_pdf_path;
